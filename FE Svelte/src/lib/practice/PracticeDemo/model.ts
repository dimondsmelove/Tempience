import { DEMO_ACTIVITIES, DEMO_KIND_ID } from './constants';
import type {
	PracticeBucket,
	PracticeEntry,
	PracticePeriod,
	PracticeRange,
	PracticeSort
} from './types';

export const addDays = (date: string, days: number): string => {
	const value = new Date(`${date}T12:00:00Z`);
	value.setUTCDate(value.getUTCDate() + days);
	return value.toISOString().slice(0, 10);
};

export const periodRange = (period: PracticePeriod, anchor: string): PracticeRange => {
	if (period === 'day') return { start: anchor, end: addDays(anchor, 1) };
	if (period === 'week') {
		const weekday = new Date(`${anchor}T12:00:00Z`).getUTCDay();
		const start = addDays(anchor, -((weekday + 6) % 7));
		return { start, end: addDays(start, 7) };
	}
	const start = `${anchor.slice(0, 7)}-01`;
	const next = new Date(`${start}T12:00:00Z`);
	next.setUTCMonth(next.getUTCMonth() + 1);
	return { start, end: next.toISOString().slice(0, 10) };
};

export const adjacentPeriod = (
	period: PracticePeriod,
	anchor: string,
	direction: -1 | 1
): string => {
	const range = periodRange(period, anchor);
	return direction === 1 ? range.end : addDays(range.start, -1);
};

export const entriesIn = (
	entries: readonly PracticeEntry[],
	range: PracticeRange,
	activityId: string | null = null,
	kindId: string = DEMO_KIND_ID
): readonly PracticeEntry[] =>
	entries.filter(
		(entry) =>
			entry.kindId === kindId &&
			entry.date >= range.start &&
			entry.date < range.end &&
			(activityId === null || entry.scopeIds.includes(activityId))
	);

export const totalMinutes = (entries: readonly PracticeEntry[]): number =>
	entries.reduce((sum, entry) => sum + entry.data.minutes, 0);

export const remainingMinutes = (actual: number, goal: number): number =>
	Math.max(0, goal - actual);

export const sortDirections = <T extends { minutes: number; weeklyMinutes: number | null }>(
	rows: readonly T[],
	period: PracticePeriod,
	order: PracticeSort
): readonly T[] => {
	if (order === 'original') return rows;
	const sign = order === 'ascending' ? 1 : -1;
	const byGoal = period === 'week' && rows.some((row) => row.weeklyMinutes !== null);
	const value = (row: T): number =>
		byGoal && row.weeklyMinutes !== null ? row.minutes / row.weeklyMinutes : row.minutes;
	// By completion, activities without a goal follow those with one, ordered by their time.
	return [...rows].sort(
		(a, b) =>
			(byGoal ? Number(a.weeklyMinutes === null) - Number(b.weeklyMinutes === null) : 0) ||
			(value(a) - value(b)) * sign
	);
};

const bucketTotals = (
	entries: readonly PracticeEntry[],
	activityIds: readonly string[]
): Pick<PracticeBucket, 'minutes' | 'sessions' | 'slices'> => ({
	minutes: totalMinutes(entries),
	sessions: entries.length,
	slices: activityIds.map((activityId) => {
		const selected = entries.filter((entry) => entry.scopeIds.includes(activityId));
		return { activityId, minutes: totalMinutes(selected), sessions: selected.length };
	})
});

export const activityBuckets = (
	entries: readonly PracticeEntry[],
	period: PracticePeriod,
	range: PracticeRange,
	activityIds: readonly string[] = DEMO_ACTIVITIES.map((activity) => activity.id)
): readonly PracticeBucket[] => {
	if (period === 'day') {
		const placed = entries.filter((entry) => entry.hour !== null);
		const unknown = entries.filter((entry) => entry.hour === null);
		const buckets =
			placed.length || !unknown.length
				? Array.from({ length: 12 }, (_, index) => {
						const hour = index * 2;
						return {
							id: `${range.start}-${hour}`,
							date: range.start,
							hour,
							...bucketTotals(
								placed.filter((entry) => entry.hour! >= hour && entry.hour! < hour + 2),
								activityIds
							)
						};
					})
				: [];
		return unknown.length
			? [
					...buckets,
					{ id: `${range.start}-undated`, date: range.start, ...bucketTotals(unknown, activityIds) }
				]
			: buckets;
	}
	const buckets: PracticeBucket[] = [];
	for (let date = range.start; date < range.end; date = addDays(date, 1))
		buckets.push({
			id: date,
			date,
			...bucketTotals(
				entries.filter((entry) => entry.date === date),
				activityIds
			)
		});
	return buckets;
};

export const weekHistory = (
	entries: readonly PracticeEntry[],
	anchor: string,
	activityId: string | null,
	source = {
		kindId: DEMO_KIND_ID,
		activityIds: DEMO_ACTIVITIES.map((activity) => activity.id) as readonly string[]
	}
): readonly PracticeBucket[] => {
	const current = periodRange('week', anchor).start;
	return Array.from({ length: 8 }, (_, index) => {
		const date = addDays(current, (index - 7) * 7);
		return {
			id: date,
			date,
			...bucketTotals(
				entriesIn(entries, periodRange('week', date), activityId, source.kindId),
				source.activityIds
			)
		};
	});
};
