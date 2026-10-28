import {
	entriesIn,
	periodRange,
	remainingMinutes,
	totalMinutes,
	weekHistory
} from '../PracticeDemo/model';
import type {
	PracticeBucket,
	PracticeChartActivity,
	PracticeDirection,
	PracticeEntry,
	PracticePeriod,
	PracticeRange
} from '../PracticeDemo/types';

/** The weekly goal of an activity in the week holding a date; null is «no goal». */
export type GoalOf = (activityId: string, date: string) => number | null;

export type LiveDirection = PracticeDirection & Readonly<{ remaining: number | null }>;

/** Per-activity fact for the range; on a week, each against its own goal of that week. */
export const liveDirections = (
	activities: readonly PracticeChartActivity[],
	entries: readonly PracticeEntry[],
	kindId: string,
	period: PracticePeriod,
	range: PracticeRange,
	goalOf: GoalOf
): readonly LiveDirection[] => {
	const all = totalMinutes(entriesIn(entries, range, null, kindId));
	return activities.map((item) => {
		const records = entriesIn(entries, range, item.id, kindId);
		const minutes = totalMinutes(records);
		const goal = period === 'week' ? goalOf(item.id, range.start) : null;
		return {
			...item,
			weeklyMinutes: goal,
			minutes,
			sessions: records.length,
			percent: goal ? Math.round((minutes / goal) * 100) : 0,
			share: all ? (minutes / all) * 100 : 0,
			remaining: goal === null ? null : remainingMinutes(minutes, goal)
		};
	});
};

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

/** Eight weeks of fact, each carrying the goal that was in force in that week. */
export const liveHistory = (
	entries: readonly PracticeEntry[],
	today: string,
	activityId: string | null,
	kindId: string,
	activityIds: readonly string[],
	goalOf: GoalOf
): readonly PracticeBucket[] =>
	weekHistory(entries, today, activityId, { kindId, activityIds }).map((week) => ({
		...week,
		goal: selectionGoal(
			activityId ? [activityId] : activityIds,
			periodRange('week', week.date).start,
			goalOf
		)
	}));
