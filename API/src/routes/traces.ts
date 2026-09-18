import {
	createTraceSchema,
	traceListQuerySchema,
	traceMembershipsInputSchema,
	traceRelatesInputSchema
} from '@chronograph/shared';
import { and, asc, eq, gte, isNull, lt, or } from 'drizzle-orm';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { db } from '../db/client';
import { traceRelations, traces } from '../db/schema';
import { assertTraceMemberships } from '../lib/enrich/assert-trace-memberships';
import { listScopeUidsForTraces } from '../lib/scope/scope-trace-bindings';
import { mapTrace } from '../lib/temporal-mappers';
import {
	RescheduleTraceAboutError,
	rescheduleTraceAbout
} from '../lib/reschedule-trace-about';
import { newUid, nowIso } from '../lib/time';
import { weekEndISO, weekStartISO, weekWindowUtc } from '../lib/week';

export const traceRoutes = new Hono();

const weekTraceWindow = (weekStart: string) => {
	const fromWeekStart = weekStartISO(weekStart);
	const { from, to } = weekWindowUtc(fromWeekStart);
	return { weekStart: fromWeekStart, from, to };
};

const activeOnly = (includeRetracted: boolean) =>
	includeRetracted ? undefined : isNull(traces.retractedAt);

traceRoutes.get('/', async (c) => {
	const query = traceListQuerySchema.parse({
		week_start: c.req.query('week_start') ?? weekStartISO(new Date().toISOString().slice(0, 10)),
		include_retracted: c.req.query('include_retracted')
	});
	const { weekStart, from, to } = weekTraceWindow(query.week_start);
	const retractedFilter = activeOnly(query.include_retracted ?? false);

	const rows = await db
		.select()
		.from(traces)
		.where(
			and(
				or(
					and(gte(traces.capturedAt, from), lt(traces.capturedAt, to)),
					and(gte(traces.aboutStart, from), lt(traces.aboutStart, to))
				),
				retractedFilter
			)
		)
		.orderBy(asc(traces.aboutStart), asc(traces.capturedAt));

	const mapped = rows.map(mapTrace);
	const scopeBindings = Object.fromEntries(listScopeUidsForTraces(rows.map((row) => row.uid)));

	return c.json({
		week_start: weekStart,
		week_end: weekEndISO(weekStart),
		traces: mapped,
		scope_bindings: scopeBindings
	});
});

traceRoutes.post('/', async (c) => {
	const body = createTraceSchema.parse(await c.req.json());
	const ts = nowIso();
	const capturedAt = body.captured_at ?? ts;

	if (body.idempotency_key) {
		const [existing] = await db
			.select()
			.from(traces)
			.where(eq(traces.idempotencyKey, body.idempotency_key));
		if (existing) return c.json(mapTrace(existing));
	}

	const row = {
		uid: newUid(),
		capturedAt,
		timezone: body.timezone,
		aboutKind: body.about_kind,
		aboutAt: body.about_at ?? null,
		aboutStart: body.about_start ?? null,
		aboutEnd: body.about_end ?? null,
		aboutTraceUid: body.about_trace_uid ?? null,
		hookText: body.hook_text,
		hookKind: body.hook_kind,
		relation: body.relation ?? null,
		valence: body.valence ?? null,
		word: body.word ?? null,
		taskRef: body.task_ref ?? null,
		intentOfTraceUid: body.intent_of_trace_uid ?? null,
		presence: body.presence ?? null,
		idempotencyKey: body.idempotency_key ?? null,
		source: 'capture',
		retractedAt: null,
		createdAt: ts
	};

	await db.insert(traces).values(row);
	return c.json(mapTrace(row), 201);
});

traceRoutes.patch('/:uid/about', async (c) => {
	const uid = c.req.param('uid');
	if (!uid) return c.json({ error: 'uid required' }, 400);
	try {
		return c.json(await rescheduleTraceAbout(uid, await c.req.json()));
	} catch (err) {
		if (err instanceof RescheduleTraceAboutError) {
			return c.json({ error: err.message }, err.status);
		}
		throw err;
	}
});

traceRoutes.get('/:uid', async (c) => {
	const uid = c.req.param('uid');
	const [row] = await db.select().from(traces).where(eq(traces.uid, uid));
	if (!row) return c.json({ error: 'Trace not found' }, 404);
	return c.json(mapTrace(row));
});

traceRoutes.post('/:uid/retract', async (c) => {
	const uid = c.req.param('uid');
	const [row] = await db.select().from(traces).where(eq(traces.uid, uid));
	if (!row) return c.json({ error: 'Trace not found' }, 404);
	if (row.retractedAt) return c.json(mapTrace(row));

	const retractedAt = nowIso();
	await db.update(traces).set({ retractedAt }).where(eq(traces.uid, uid));

	const [updated] = await db.select().from(traces).where(eq(traces.uid, uid));
	return c.json(mapTrace(updated!));
});

const attachTraceScopes = async (c: Context) => {
	const uid = c.req.param('uid');
	if (!uid) return c.json({ error: 'uid required' }, 400);
	const body = traceMembershipsInputSchema.parse(await c.req.json());
	try {
		const result = assertTraceMemberships(uid, body);
		return c.json(result, 201);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Scope attach failed';
		if (message.startsWith('Trace not found')) return c.json({ error: message }, 404);
		if (message.startsWith('Continuity not found')) return c.json({ error: message }, 404);
		throw err;
	}
};

traceRoutes.post('/:uid/scopes', attachTraceScopes);
traceRoutes.post('/:uid/memberships', attachTraceScopes);

traceRoutes.post('/:uid/relates', async (c) => {
	const uid = c.req.param('uid');
	if (!uid) return c.json({ error: 'uid required' }, 400);
	const body = traceRelatesInputSchema.parse(await c.req.json());
	const [traceRow] = await db.select().from(traces).where(eq(traces.uid, uid));
	if (!traceRow) return c.json({ error: 'Trace not found' }, 404);

	const ts = nowIso();
	const row = {
		uid: newUid(),
		fromTraceUid: uid,
		toKind: body.to_kind,
		toUid: body.to_uid,
		linkKind: 'relates_to' as const,
		provenance: 'asserted' as const,
		creator: 'user' as const,
		evidenceJson: '[]',
		status: 'active' as const,
		ownerUid: 'local-user',
		spaceUid: 'personal',
		label: body.label ?? null,
		createdAt: ts,
		updatedAt: ts
	};

	await db.insert(traceRelations).values(row);
	return c.json(
		{
			link: {
				uid: row.uid,
				from_kind: 'trace',
				from_uid: row.fromTraceUid,
				to_kind: row.toKind,
				to_uid: row.toUid,
				link_kind: row.linkKind,
				provenance: row.provenance,
				creator: row.creator,
				evidence_refs: [],
				status: row.status,
				owner_uid: row.ownerUid,
				space_uid: row.spaceUid,
				label: row.label,
				created_at: row.createdAt,
				updated_at: row.updatedAt
			}
		},
		201
	);
});
