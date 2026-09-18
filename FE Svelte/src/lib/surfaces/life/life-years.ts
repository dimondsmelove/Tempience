import type { LifeWeekCell } from '@chronograph/shared';
import { displayYearForWeek } from './navigation';

export type WeekCoverageRow = {
	week_start: string;
	has_traces: boolean;
};

export type LifeYearRow = {
	yearIndex: number;
	label: string;
	weeks: LifeWeekCell[];
};

export const groupWeeksByCalendarYear = (
	weeks: LifeWeekCell[],
	periodFrom: string
): LifeYearRow[] => {
	const byYear = new Map<number, LifeWeekCell[]>();

	for (const week of weeks) {
		const year = displayYearForWeek(week.week_start, periodFrom);
		const list = byYear.get(year) ?? [];
		list.push(week);
		byYear.set(year, list);
	}

	return [...byYear.entries()]
		.sort(([a], [b]) => a - b)
		.map(([year, yearWeeks]) => ({
			yearIndex: year,
			label: String(year),
			weeks: yearWeeks
		}));
};

export const coverageByWeek = (coverage: WeekCoverageRow[]): Map<string, boolean> =>
	new Map(coverage.map((row) => [row.week_start, row.has_traces]));
