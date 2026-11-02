import {
	addDays,
	entriesIn,
	periodRange,
	remainingMinutes,
	totalMinutes,
	weekHistory
} from '../../model/Practice/model';
import type {
	PracticeBucket,
	PracticeChartActivity,
	PracticeDirection,
	PracticeEntry,
	PracticePeriod,
	PracticeRange
} from '../../model/Practice/types';

/** The weekly goal of an activity in the week holding a date; null is «no goal». */
export type GoalOf = (activityId: string, date: string) => number | null;
export type PlannedOf = (activityId: string, date: string) => boolean;

export type LiveDirection = PracticeDirection &
	Readonly<{ remaining: number | null; unplannedMinutes: number }>;

/** Per-activity fact for the range; on a week, each against its own goal of that week. */
export const liveDirections = (
	activities: readonly PracticeChartActivity[],
	entries: readonly PracticeEntry[],
	kindId: string,
	period: PracticePeriod,
	range: PracticeRange,
	goalOf: GoalOf,
	plannedOf: PlannedOf = () => true
): readonly LiveDirection[] => {
	const all = totalMinutes(entriesIn(entries, range, null, kindId));
	return activities.map((item) => {
		const records = entriesIn(entries, range, item.id, kindId);
		const minutes = totalMinutes(records);
		const unplannedMinutes = totalMinutes(
			records.filter((record) => !plannedOf(item.id, record.date))
		);
		const goal = period === 'week' ? goalOf(item.id, range.start) : null;
		return {
			...item,
			weeklyMinutes: goal,
			minutes,
			unplannedMinutes,
			sessions: records.length,
			percent: goal ? Math.round((minutes / goal) * 100) : 0,
			share: all ? (minutes / all) * 100 : 0,
			remaining: goal === null ? null : remainingMinutes(minutes, goal)
		};
	});
};

/** Actual minutes belonging to a plan, excluding facts outside their own week's scope set. */
export const plannedMinutes = (
	entries: readonly PracticeEntry[],
	range: PracticeRange,
	activityId: string | null,
	kindId: string,
	plannedOf: PlannedOf
): number =>
	totalMinutes(
		entriesIn(entries, range, activityId, kindId).filter((entry) =>
			entry.scopeIds.some((id) => plannedOf(id, entry.date))
		)
	);
/**
 * The goal of a selection for one week: its activity's goal, or for all activities the sum of
 * goals when every activity has one. Remaining is summed per activity, clamped at zero each, so
 * a surplus in one never covers another's shortfall.
 */
export const selectionGoal = (
	activityIds: readonly string[],
	week: string,
	goalOf: GoalOf
): number | null => {
	const goals = activityIds.map((id) => goalOf(id, week));
	return goals.length && goals.every((goal) => goal !== null)
		? goals.reduce<number>((sum, goal) => sum + goal!, 0)
		: null;
};

export const selectionRemaining = (rows: readonly LiveDirection[]): number | null =>
	rows.length && rows.every((row) => row.remaining !== null)
		? rows.reduce((sum, row) => sum + row.remaining!, 0)
		: null;

/** Activities planned or represented by facts in the selected range, regardless of UI filter. */
export const rangeActivityIds = (
	entries: readonly PracticeEntry[],
	range: PracticeRange,
	kindId: string,
	plannedIds: readonly string[] = []
): readonly string[] =>
	Array.from(
		new Set([
			...plannedIds,
			...entriesIn(entries, range, null, kindId).flatMap((entry) => entry.scopeIds)
		])
	);

/** Active activities with facts or a plan in the nine weeks shown by history. */
export const historyActivityIds = (
	entries: readonly PracticeEntry[],
	today: string,
	kindId: string,
	activeIds: readonly string[],
	plannedIdsOf: (week: string) => readonly string[] = () => []
): readonly string[] => {
	const currentWeek = periodRange('week', today).start;
	const firstWeek = addDays(currentWeek, -28);
	const lastWeekEnd = addDays(currentWeek, 35);
	const relevant = new Set(
		entriesIn(entries, { start: firstWeek, end: lastWeekEnd }, null, kindId).flatMap(
			(entry) => entry.scopeIds
		)
	);
	for (let week = firstWeek; week < lastWeekEnd; week = addDays(week, 7))
		plannedIdsOf(week).forEach((id) => relevant.add(id));
	return activeIds.filter((id) => relevant.has(id));
};

/** Nine weeks of fact, each carrying the goal that was in force in that week. */
export const liveHistory = (
	entries: readonly PracticeEntry[],
	today: string,
	activityId: string | null,
	kindId: string,
	activityIds: readonly string[],
	goalOf: GoalOf,
	plannedIdsOf: (week: string) => readonly string[] = () => activityIds
): readonly PracticeBucket[] =>
	weekHistory(entries, today, activityId, { kindId, activityIds }).map((week) => ({
		...week,
		goal: selectionGoal(
			activityId ? [activityId] : plannedIdsOf(periodRange('week', week.date).start),
			periodRange('week', week.date).start,
			goalOf
		)
	}));
