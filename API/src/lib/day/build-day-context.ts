import type { DayContext, DayContextQuery, DayScopeTouch, ScopeKind, Trace } from '@chronograph/shared';
import { addDaysISO, utcInstantForZonedLocal } from '@chronograph/shared';
import { and, gte, inArray, isNull, lt } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopes, traces } from '../../db/schema';
import { mapTrace } from '../temporal-mappers';
import { buildInboxHooks } from '../inbox/build-inbox-hooks';
import { listScopeUidsForTraces } from '../scope/scope-trace-bindings';

const dayWindowForZone = (date: string, timeZone: string): { from: string; to: string } => {
	const from = utcInstantForZonedLocal(date, 0, 0, timeZone).toISOString();
	const next = addDaysISO(date, 1);
	const to = utcInstantForZonedLocal(next, 0, 0, timeZone).toISOString();
	return { from, to };
};

const recordTouch = (
	touchMap: Map<string, DayScopeTouch & { trace_uids: Set<string> }>,
	kind: ScopeKind,
	uid: string,
	name: string,
	traceUid: string
): void => {
	const key = `${kind}:${uid}`;
	const existing = touchMap.get(key);
	if (existing) {
		existing.trace_uids.add(traceUid);
		existing.trace_count = existing.trace_uids.size;
		return;
	}
	touchMap.set(key, {
		kind,
		uid,
		name,
		trace_count: 1,
		trace_uids: new Set([traceUid])
	});
};

export const buildDayContext = async (date: string, query: DayContextQuery): Promise<DayContext> => {
	const { from, to } = dayWindowForZone(date, query.timezone);

	const traceRows = await db
		.select()
		.from(traces)
		.where(and(isNull(traces.retractedAt), gte(traces.capturedAt, from), lt(traces.capturedAt, to)));

	const mappedTraces = traceRows.map(mapTrace) as Trace[];
	const traceUids = mappedTraces.map((trace) => trace.uid);

	const touchMap = new Map<string, DayScopeTouch & { trace_uids: Set<string> }>();
	const scopeBindings = listScopeUidsForTraces(traceUids);

	const scopeUidSet = new Set<string>();
	for (const scopeUids of scopeBindings.values()) {
		for (const scopeUid of scopeUids) scopeUidSet.add(scopeUid);
	}

	const scopeRows =
		scopeUidSet.size > 0
			? await db.select().from(scopes).where(inArray(scopes.uid, [...scopeUidSet]))
			: [];
	const scopeByUid = new Map(scopeRows.map((row) => [row.uid, row]));

	for (const [traceUid, scopeUids] of scopeBindings) {
		for (const scopeUid of scopeUids) {
			const scopeRow = scopeByUid.get(scopeUid);
			if (!scopeRow) continue;
			recordTouch(
				touchMap,
				scopeRow.kind as ScopeKind,
				scopeRow.uid,
				scopeRow.name,
				traceUid
			);
		}
	}

	const scope_touches = [...touchMap.values()].map(({ trace_uids: _t, ...touch }) => touch);

	const inbox = await buildInboxHooks({ since: from, state: 'all', limit: 200 });

	const enrichment_summary = { bare: 0, scoped: 0, woven: 0, interpreted: 0 };
	for (const hook of inbox.hooks) {
		if (!traceUids.includes(hook.trace.uid)) continue;
		enrichment_summary[hook.enrichment_state] += 1;
	}

	return {
		date,
		timezone: query.timezone,
		traces: mappedTraces,
		scope_touches,
		enrichment_summary
	} as DayContext;
};
