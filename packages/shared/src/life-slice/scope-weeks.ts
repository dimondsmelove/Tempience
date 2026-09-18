import { addDaysISO } from "../temporal/week-zone";
import { weekStartISO } from "./life-weeks";

export type ScopeInterval = {
	start_at: string | null;
	end_at: string | null;
};

export type WeekBounds = {
	fromWeek: string;
	toWeek: string;
	horizonDate: string;
	/** ISO Monday of the current week — used to clip open-ended scopes. */
	currentWeekStart?: string;
	/** When false (default), open-ended scope intervals stop at currentWeekStart. */
	includeFutureScope?: boolean;
};

const isoDate = (value: string): string => value.slice(0, 10);

const intervalEndInstant = (endAt: string | null, bounds: WeekBounds): string =>
	endAt ?? `${bounds.horizonDate}T23:59:59.999Z`;

const lastScopeWeek = (interval: ScopeInterval, bounds: WeekBounds): string => {
	const endWeek = weekStartISO(isoDate(intervalEndInstant(interval.end_at, bounds)));
	if (bounds.includeFutureScope || !bounds.currentWeekStart) return endWeek;
	return endWeek > bounds.currentWeekStart ? bounds.currentWeekStart : endWeek;
};

export const iterateWeekStartsInInterval = (
	interval: ScopeInterval,
	bounds: WeekBounds
): string[] => {
	if (!interval.start_at) return [];

	const startWeek = weekStartISO(isoDate(interval.start_at));
	const fromWeek = bounds.fromWeek;
	const toWeek = bounds.toWeek;
	const cappedEndWeek = lastScopeWeek(interval, bounds);

	const weeks: string[] = [];
	let week = startWeek < fromWeek ? fromWeek : startWeek;
	const lastWeek = cappedEndWeek > toWeek ? toWeek : cappedEndWeek;

	while (week <= lastWeek) {
		weeks.push(week);
		week = addDaysISO(week, 7);
	}

	return weeks;
};

export const weekStartsForIntervals = (
	intervals: ScopeInterval[],
	bounds: WeekBounds
): Set<string> => {
	const result = new Set<string>();
	for (const interval of intervals) {
		for (const week of iterateWeekStartsInInterval(interval, bounds)) {
			result.add(week);
		}
	}
	return result;
};
