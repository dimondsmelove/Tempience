import type {
	ScopeContext,
	ScopeContextQuery,
	ScopeKind,
	ScopeLens,
	ScopeLinkedScope,
	ScopeTraceItem,
	Task,
	Trace
} from '@chronograph/shared';
import { dedupeTraceCandidates, type TraceAssemblyCandidate } from '@chronograph/shared';
import { and, asc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopePhases, scopes, traces } from '../../db/schema';
import { listTraceUidsForScope } from './scope-trace-bindings';
import { mapScopeEntity, scopeToTask } from './scope-mappers';
import { mapContinuitySegment, mapTrace } from '../temporal-mappers';
import { nowIso } from '../time';
import { weekEndISO, weekStartISO, weekWindowUtc } from '../week';

const applyLensFilter = (
	lens: ScopeLens,
	viewTime: string,
	scope: {
		started_at: string | null;
		ended_at: string | null;
	},
	traceItems: ScopeTraceItem[],
	commitments: Task[]
): { traces: ScopeTraceItem[]; commitments: Task[] } => {
	if (lens === 'atlas-week' || lens === 'ledger-week') {
		const weekStart = weekStartISO(viewTime.slice(0, 10));
		const weekEnd = weekEndISO(weekStart);
		const { from, to } = weekWindowUtc(weekStart);
		const weekTraces = traceItems.filter(
			(item) => item.trace.captured_at >= from && item.trace.captured_at < to
		);
		if (lens === 'atlas-week') {
			return { traces: weekTraces, commitments };
		}
		return {
			traces: weekTraces,
			commitments: commitments.filter((task) => {
				if (!task.due_date) return false;
				const due = task.due_date.slice(0, 10);
				return due >= weekStart && due <= weekEnd;
			})
		};
	}
	if (lens === 'life-strip' && scope.started_at) {
		const end = scope.ended_at ?? viewTime;
		return {
			traces: traceItems.filter(
				(item) => item.trace.captured_at >= scope.started_at! && item.trace.captured_at <= end
			),
			commitments
		};
	}
	return { traces: traceItems, commitments };
};

const collectDescendantScopeUids = async (rootUid: string): Promise<string[]> => {
	const rows = await db
		.select({ uid: scopes.uid, parentScopeUid: scopes.parentScopeUid })
		.from(scopes);
	const byParent = new Map<string | null, string[]>();
	for (const row of rows) {
		const list = byParent.get(row.parentScopeUid ?? null) ?? [];
		list.push(row.uid);
		byParent.set(row.parentScopeUid ?? null, list);
	}

	const result: string[] = [];
	const walk = (uid: string): void => {
		result.push(uid);
		for (const child of byParent.get(uid) ?? []) walk(child);
	};
	walk(rootUid);
	return result;
};

const commitmentUidsForScope = async (kind: ScopeKind, uid: string): Promise<string[]> => {
	if (kind === 'continuity') {
		const processChildren = await db
			.select({ uid: scopes.uid })
			.from(scopes)
			.where(and(eq(scopes.parentScopeUid, uid), eq(scopes.kind, 'process')));
		const nested = await Promise.all(processChildren.map((row) => collectDescendantScopeUids(row.uid)));
		return [...new Set(nested.flat())];
	}

	if (kind === 'process') {
		return collectDescendantScopeUids(uid);
	}

	if (kind === 'project') {
		const children = await db.select().from(scopes).where(eq(scopes.parentScopeUid, uid));
		const roots = children.filter((row) => row.kind === 'process' || row.kind === 'task');
		const nested = await Promise.all(
			roots.filter((row) => row.kind === 'process').map((row) => collectDescendantScopeUids(row.uid))
		);
		const taskUids = roots.filter((row) => row.kind === 'task').map((row) => row.uid);
		return [...new Set([...nested.flat(), ...taskUids])];
	}

	return [];
};

const buildLinkedScopes = async (kind: ScopeKind, uid: string): Promise<ScopeLinkedScope[]> => {
	const linked: ScopeLinkedScope[] = [];

	if (kind === 'continuity') {
		const children = await db
			.select()
			.from(scopes)
			.where(and(eq(scopes.parentScopeUid, uid), eq(scopes.kind, 'process')));
		return children.map((row) => ({
			uid: row.uid,
			kind: 'process',
			name: row.name,
			link_label: null
		}));
	}

	if (kind === 'process') {
		const [scopeRow] = await db.select().from(scopes).where(eq(scopes.uid, uid));
		if (!scopeRow?.parentScopeUid) return linked;
		const [parent] = await db
			.select()
			.from(scopes)
			.where(and(eq(scopes.uid, scopeRow.parentScopeUid), eq(scopes.kind, 'continuity')));
		if (!parent) return linked;
		linked.push({
			uid: parent.uid,
			kind: 'continuity',
			name: parent.name,
			link_label: null
		});
	}

	return linked;
};

const collectTraceCandidates = async (
	scopeUid: string,
	commitmentUids: string[]
): Promise<TraceAssemblyCandidate[]> => {
	const candidates: TraceAssemblyCandidate[] = [];

	for (const traceUid of listTraceUidsForScope(scopeUid)) {
		candidates.push({ trace_uid: traceUid, attachment: 'membership' });
	}

	for (const childUid of commitmentUids) {
		if (childUid === scopeUid) continue;
		for (const traceUid of listTraceUidsForScope(childUid)) {
			candidates.push({
				trace_uid: traceUid,
				attachment: 'membership_via_task',
				via_task_uid: childUid
			});
		}
	}

	if (commitmentUids.length > 0) {
		const taskRefRows = await db
			.select()
			.from(traces)
			.where(and(inArray(traces.taskRef, commitmentUids), isNull(traces.retractedAt)));
		for (const row of taskRefRows) {
			candidates.push({
				trace_uid: row.uid,
				attachment: 'task_ref',
				via_task_uid: row.taskRef
			});
		}
	}

	return candidates;
};

export const buildScopeContext = async (
	kind: ScopeKind,
	uid: string,
	query: ScopeContextQuery
): Promise<ScopeContext | null> => {
	const [scopeRow] = await db
		.select()
		.from(scopes)
		.where(and(eq(scopes.uid, uid), eq(scopes.kind, kind)));
	if (!scopeRow) return null;

	const scope = mapScopeEntity(scopeRow);
	const viewTime = query.view_time ?? nowIso();
	const commitmentUids = await commitmentUidsForScope(kind, uid);

	const segmentRows = await db
		.select()
		.from(scopePhases)
		.where(eq(scopePhases.continuityUid, uid))
		.orderBy(asc(scopePhases.sortOrder));
	const phases = segmentRows.map(mapContinuitySegment) as ScopeContext['phases'];

	const commitmentRows =
		commitmentUids.length > 0
			? await db.select().from(scopes).where(inArray(scopes.uid, commitmentUids))
			: [];
	const projectUid = kind === 'project' ? uid : null;
	const commitments = commitmentRows.map((row) => scopeToTask(row, projectUid));

	const linked_scopes = await buildLinkedScopes(kind, uid);
	const candidates = await collectTraceCandidates(uid, commitmentUids);
	const deduped = dedupeTraceCandidates(candidates);

	const traceUidList = deduped.map((item) => item.trace_uid);
	const traceRows =
		traceUidList.length > 0
			? await db
					.select()
					.from(traces)
					.where(
						and(
							inArray(traces.uid, traceUidList),
							isNull(traces.retractedAt),
							lte(traces.capturedAt, viewTime)
						)
					)
			: [];

	const traceByUid = new Map(traceRows.map((row) => [row.uid, row]));
	const traceItems: ScopeTraceItem[] = [];
	for (const item of deduped) {
		const row = traceByUid.get(item.trace_uid);
		if (!row) continue;
		traceItems.push({
			trace: mapTrace(row) as Trace,
			attachment: item.attachment,
			via_task_uid: item.via_task_uid ?? null
		});
	}

	traceItems.sort(
		(a, b) => new Date(b.trace.captured_at).getTime() - new Date(a.trace.captured_at).getTime()
	);
	const lensFiltered = applyLensFilter(query.lens, viewTime, scope, traceItems, commitments as Task[]);
	const limitedTraces = lensFiltered.traces.slice(0, query.trace_limit);

	return {
		scope,
		phases,
		commitments: lensFiltered.commitments,
		linked_scopes,
		traces: limitedTraces,
		closures: [],
		projection_meta: {
			view_time: viewTime,
			lens: query.lens,
			trace_count: limitedTraces.length,
			dedupe_applied: true
		}
	} as ScopeContext;
};
