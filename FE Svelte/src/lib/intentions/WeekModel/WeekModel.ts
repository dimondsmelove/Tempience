import { Temporal } from 'temporal-polyfill';
import { traceMarkTime } from '$lib/model/Projection/marks';
import { traceAboutTimeBounds } from '$lib/state/triplit/trace-time';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import type { WeekBuckets } from './types';

const dateAt = (instant: number, zone: string) =>
	Temporal.Instant.fromEpochMilliseconds(instant).toZonedDateTimeISO(zone).toPlainDate();
const midnight = (date: Temporal.PlainDate, zone: string) =>
	date.toZonedDateTime(zone).epochMilliseconds;

/** A calendar week begins at Monday midnight in the grouping zone. */
export const weekStartAt = (anchor: number, zone: string): number => {
	const day = dateAt(anchor, zone);
	return midnight(day.subtract({ days: day.dayOfWeek - 1 }), zone);
};

/** Convert axis calendar coordinates to midnight in the grouping zone, not the browser zone. */
const calendarBoundary = (value: number, zone: string): number => {
	const date = new Date(value).toISOString().slice(0, 10);
	return midnight(Temporal.PlainDate.from(date), zone);
};

export const boundsOf = (trace: ExplorerTrace, now: number, zone: string) => {
	const mark = traceMarkTime(trace, now);
	if (!mark || trace.aboutTime?.basis !== 'absolute') return null;
	const bounds = traceAboutTimeBounds(trace.aboutKind, trace.aboutTime, trace.statedDuration);
	if (!bounds) return null;
	const coarse = trace.aboutTime.precision !== 'minute';
	const start = coarse ? calendarBoundary(bounds.start, zone) : bounds.start;
	let end = mark.open ? Infinity : coarse ? calendarBoundary(bounds.end, zone) : bounds.end;
	if (trace.statedDuration) {
		// Duration begins at the latest possible start, not at the first day of a window.
		const latestStart = coarse
			? midnight(dateAt(end, zone).subtract({ days: 1 }), zone)
			: trace.aboutTime.end === null
				? start
				: end - 60_000;
		const startZoned = Temporal.Instant.fromEpochMilliseconds(latestStart).toZonedDateTimeISO(zone);
		const duration = trace.statedDuration;
		end = Math.max(
			end,
			startZoned.add(
				duration.unit === 'day' ? { days: duration.amount } : { minutes: duration.amount }
			).epochMilliseconds
		);
	}
	return { start, end };
};

/** Every intention enters exactly one bucket, or contributes once to outside. */
export const weekBuckets = (
	traces: readonly ExplorerTrace[],
	anchor: number,
	now: number,
	zone: string
): WeekBuckets => {
	const weekStart = weekStartAt(anchor, zone);
	const monday = dateAt(weekStart, zone);
	const weekEnd = midnight(monday.add({ days: 7 }), zone);
	const today = midnight(dateAt(now, zone), zone);
	const result: WeekBuckets = {
		weekStart,
		days: Array.from({ length: 7 }, (_, index) => ({
			dayKey: monday.add({ days: index }).toString(),
			items: []
		})),
		week: [],
		undated: [],
		review: [],
		later: [],
		outside: 0
	};
	const starts = new Map<ExplorerTrace, number>();
	for (const trace of traces) {
		if (!isIntentionRelation(trace.relation)) continue;
		const bounds = boundsOf(trace, now, zone);
		if (!bounds) {
			if (trace.intentOpen !== false) result.undated.push(trace);
			else result.outside++;
			continue;
		}
		starts.set(trace, bounds.start);
		if (trace.intentOpen !== false && bounds.end <= today) {
			result.review.push(trace);
			continue;
		}
		const startDate = dateAt(bounds.start, zone);
		const oneDayEnd = Temporal.Instant.fromEpochMilliseconds(bounds.start)
			.toZonedDateTimeISO(zone)
			.add({ days: 1 }).epochMilliseconds;
		if (bounds.end <= oneDayEnd) {
			const bucket = result.days.find((day) => day.dayKey === startDate.toString());
			if (bucket && (trace.intentOpen === false || midnight(startDate, zone) >= today))
				bucket.items.push(trace);
			else if (trace.intentOpen !== false) result.later.push(trace);
			else result.outside++;
		} else if (bounds.start < weekEnd && bounds.end > weekStart) result.week.push(trace);
		else if (trace.intentOpen !== false) result.later.push(trace);
		else result.outside++;
	}
	const sort = (a: ExplorerTrace, b: ExplorerTrace) =>
		(starts.get(a) ?? Infinity) - (starts.get(b) ?? Infinity) ||
		(a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
	for (const day of result.days) day.items.sort(sort);
	result.week.sort(sort);
	result.undated.sort(sort);
	result.review.sort(sort);
	result.later.sort(sort);
	return result;
};

/** Closed descendants stay visible beneath a parent already on this backlog shelf. */
export const backlogWithClosedChildren = (
	items: readonly ExplorerTrace[],
	traces: readonly ExplorerTrace[],
	hierarchy: import('../Hierarchy/Hierarchy').Hierarchy
): ExplorerTrace[] => {
	const result = [...items];
	const seen = new Set(result.map((item) => item.id));
	const byId = new Map(traces.map((trace) => [trace.id, trace]));
	for (let i = 0; i < result.length; i++) {
		for (const id of hierarchy.get(result[i].id)?.children ?? []) {
			const child = byId.get(id);
			if (child?.intentOpen === false && !seen.has(id)) {
				result.push(child);
				seen.add(id);
			}
		}
	}
	return result;
};
