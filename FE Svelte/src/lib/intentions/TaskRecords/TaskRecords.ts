import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { SEARCH_LIMIT } from './constants';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { traceEventKey } from '$lib/state/triplit/Traces/event-time';

/** Live snapshot facts, newest first, excluding the task and its existing records. */
export const recordCandidates = (
	traces: readonly ExplorerTrace[],
	taskId: string,
	linkedIds: readonly string[],
	query: string
) => {
	const excluded = new Set([taskId, ...linkedIds]);
	const needle = query.trim().toLocaleLowerCase();
	const eventKey = (trace: ExplorerTrace) =>
		traceEventKey({
			aboutKind: trace.aboutKind,
			aboutTime: trace.aboutTime,
			statedDuration: trace.statedDuration ?? null
		}) ?? '';
	return traces
		.filter(
			(trace) =>
				!excluded.has(trace.id) &&
				!isIntentionRelation(trace.relation) &&
				`${trace.displayTitle ?? ''} ${trace.content}`.toLocaleLowerCase().includes(needle)
		)
		.toSorted((a, b) => eventKey(b).localeCompare(eventKey(a)) || a.id.localeCompare(b.id))
		.slice(0, SEARCH_LIMIT);
};
