import { traceMarkTime } from '$lib/model/Projection/marks';
import {
	ancestorsOf,
	scopeMembership,
	scopeTree,
	subtreeTraceIds
} from '$lib/model/Projection/tree';
import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import type { ScopeContext } from './types';

const sortedByTime = (traces: readonly ExplorerTrace[]): ScopeContext['traces'] =>
	traces
		.map((record) => ({ record, time: traceMarkTime(record) }))
		.sort(
			(a, b) =>
				(a.time?.start ?? Infinity) - (b.time?.start ?? Infinity) ||
				a.record.id.localeCompare(b.record.id)
		);

/**
 * The «Без Scope» row as a context of its own: the records in no Scope, with the range
 * they cover, under a record that stands for the row (its name is the row's translated one).
 */
const unscopedContext = (snapshot: ExplorerSnapshot): ScopeContext => {
	const membership = scopeMembership(snapshot.traces, snapshot.scopes, snapshot.intersections);
	const traces = sortedByTime(
		snapshot.traces.filter((trace) => (membership.scopesByTrace.get(trace.id)?.size ?? 0) === 0)
	);
	const dates = traces.flatMap((trace) => (trace.time ? [trace.time.start, trace.time.end] : []));
	return {
		record: {
			id: UNSCOPED_ROW_ID,
			name: '',
			note: null,
			startedAt: null,
			endedAt: null,
			origin: { kind: 'canonical', sourceId: '' }
		},
		parent: null,
		children: [],
		traces,
		range: dates.length ? { start: Math.min(...dates), end: Math.max(...dates) } : null
	};
};

/** Entity context uses the same hierarchy and membership as the rail's all-time counters. */
export const scopeContext = (snapshot: ExplorerSnapshot, scopeId: string): ScopeContext | null => {
	if (scopeId === UNSCOPED_ROW_ID) return unscopedContext(snapshot);
	const record = snapshot.scopes.find((scope) => scope.id === scopeId);
	if (!record) return null;
	const tree = scopeTree(snapshot.scopes, snapshot.intersections);
	const membership = scopeMembership(snapshot.traces, snapshot.scopes, snapshot.intersections);
	const ids = subtreeTraceIds(tree, membership, new Set()).get(scopeId) ?? new Set<string>();
	const scopes = snapshot.scopes.filter(
		(scope) => scope.id === scopeId || ancestorsOf(tree, scope.id).includes(scopeId)
	);
	const scopeIds = new Set(scopes.map((scope) => scope.id));
	const traces = sortedByTime(snapshot.traces.filter((trace) => ids.has(trace.id)));
	const dates = [
		...scopes.flatMap((scope) => [scope.startedAt, scope.endedAt]),
		...snapshot.scopeSegments
			.filter((segment) => scopeIds.has(segment.scopeId))
			.flatMap((segment) => [segment.startAt, segment.endAt])
	]
		.filter((date): date is string => date !== null)
		.map(Date.parse)
		.filter(Number.isFinite);
	for (const trace of traces) if (trace.time) dates.push(trace.time.start, trace.time.end);
	return {
		record,
		parent: snapshot.scopes.find((scope) => scope.id === tree.parent.get(scopeId)) ?? null,
		children: snapshot.scopes.filter((scope) => tree.parent.get(scope.id) === scopeId),
		traces,
		range: dates.length ? { start: Math.min(...dates), end: Math.max(...dates) } : null
	};
};
