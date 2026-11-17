import { Temporal } from 'temporal-polyfill';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import { traceEventKey } from '$lib/state/triplit/Traces/event-time';
import { boundsOf } from '../WeekModel/WeekModel';
import type { DayTrace } from './types';

const localDay = (instant: number, zone: string) =>
	Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(zone).toPlainDate().toString();
const taskDay = (task: ExplorerTrace, now: number, zone: string): string | null => {
	const bounds = boundsOf(task, now, zone);
	if (!bounds || !Number.isFinite(bounds.end) || bounds.end <= bounds.start) return null;
	const start = localDay(bounds.start, zone);
	return start === localDay(bounds.end - 1, zone) ? start : null;
};
const factDay = (fact: ExplorerTrace, zone: string): string | null => {
	const time = fact.aboutTime;
	if (!time || time.basis !== 'absolute' || !['minute', 'day'].includes(time.precision))
		return null;
	const key = traceEventKey(fact);
	if (!key) return null;
	return time.precision === 'day' ? key.slice(0, 10) : localDay(Date.parse(key), zone);
};
/** Project live snapshot evidence into the visible week; assessment is intentionally irrelevant. */
export const tracesByDay = (
	snapshot: Pick<ExplorerSnapshot, 'traces' | 'intersections'>,
	zone: string,
	dayKeys: readonly string[],
	now: number
): Map<string, DayTrace[]> => {
	const result = new Map(dayKeys.map((day) => [day, [] as DayTrace[]]));
	const facts = new Map(
		snapshot.traces
			.filter((trace) => !isIntentionRelation(trace.relation))
			.map((trace) => [trace.id, trace])
	);
	const tasks = new Map(
		snapshot.traces
			.filter((trace) => isIntentionRelation(trace.relation))
			.map((trace) => [trace.id, trace])
	);
	const seen = new Set<string>();
	for (const link of snapshot.intersections) {
		if (link.kind !== 'evidence_for') continue;
		const fact = facts.get(link.fromId),
			task = tasks.get(link.toId);
		if (!fact || !task || fact.id === task.id) continue;
		const pair = JSON.stringify([fact.id, task.id]);
		if (seen.has(pair)) continue;
		seen.add(pair);
		const sourceDay = factDay(fact, zone),
			destinationDay = taskDay(task, now, zone);
		if (!sourceDay || !destinationDay || sourceDay === destinationDay) continue;
		result.get(sourceDay)?.push({
			factId: fact.id,
			text: fact.content,
			taskId: task.id,
			taskTitle: task.content,
			taskDay: destinationDay,
			factDay: sourceDay
		});
	}
	return result;
};
