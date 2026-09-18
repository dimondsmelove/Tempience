import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { LifeWeekCell } from '@chronograph/shared';
import {
	calendarMonthBounds,
	calendarYearBounds,
	decadeBounds,
	displayYearForWeek,
	type LifePeriod,
	type LifeScale,
	type LifeUrlInput
} from './navigation';
import { groupWeeksByCalendarYear } from './life-years';

export type LifeGridCell = {
	id: string;
	label: string;
	weekStarts: string[];
	navigateWeek: string | null;
	isCurrent: boolean;
	isPast: boolean;
	isFuture: boolean;
	empty: boolean;
};

export type LifeGridRow = {
	id: string;
	label: string;
	cells: LifeGridCell[];
};

/** The month columns of the year grid, named in the given language. */
const monthLabels = (language: Locale): string[] =>
	translate(language, 'life.monthsShort').split(',');

const periodYearRange = (period: LifePeriod): { fromYear: number; toYear: number } => ({
	fromYear: Number(period.from.slice(0, 4)),
	toYear: Number(period.to.slice(0, 4))
});

const toCell = (id: string, label: string, weeks: LifeWeekCell[]): LifeGridCell => {
	if (weeks.length === 0) {
		return {
			id,
			label,
			weekStarts: [],
			navigateWeek: null,
			isCurrent: false,
			isPast: false,
			isFuture: false,
			empty: true
		};
	}

	return {
		id,
		label,
		weekStarts: weeks.map((week) => week.week_start),
		navigateWeek: weeks[0].week_start,
		isCurrent: weeks.some((week) => week.is_current),
		isFuture: weeks.every((week) => week.is_future),
		isPast: weeks.every((week) => week.is_past),
		empty: false
	};
};

export const weekScaleGrid = (weeks: LifeWeekCell[], period: LifePeriod): LifeGridRow[] =>
	groupWeeksByCalendarYear(weeks, period.from).map((row) => ({
		id: `cal-year-${row.label}`,
		label: row.label,
		cells: row.weeks.map((week) => toCell(week.week_start, week.week_start.slice(5), [week]))
	}));

export const buildMonthGrid = (
	weeks: LifeWeekCell[],
	period: LifePeriod,
	language: Locale = 'ru'
): LifeGridRow[] => {
	const { fromYear, toYear } = periodYearRange(period);
	const byYear = new Map<number, LifeWeekCell[]>();

	for (const week of weeks) {
		const year = displayYearForWeek(week.week_start, period.from);
		if (year < fromYear || year > toYear) continue;
		const list = byYear.get(year) ?? [];
		list.push(week);
		byYear.set(year, list);
	}

	return [...byYear.entries()]
		.sort(([a], [b]) => a - b)
		.map(([year, yearWeeks]) => ({
			id: `cal-year-${year}`,
			label: String(year),
			cells: monthLabels(language).map((label, index) => {
				const month = String(index + 1).padStart(2, '0');
				const prefix = `${year}-${month}`;
				const bucket = yearWeeks.filter((week) => week.week_start.startsWith(prefix));
				return toCell(`month-${prefix}`, label, bucket);
			})
		}));
};

export const buildYearGrid = (weeks: LifeWeekCell[], period: LifePeriod): LifeGridRow[] => {
	const { fromYear, toYear } = periodYearRange(period);
	const byDecade = new Map<number, Map<number, LifeWeekCell[]>>();

	for (const week of weeks) {
		const year = displayYearForWeek(week.week_start, period.from);
		if (year < fromYear || year > toYear) continue;
		const decade = Math.floor(year / 10) * 10;
		const decadeMap = byDecade.get(decade) ?? new Map<number, LifeWeekCell[]>();
		const list = decadeMap.get(year) ?? [];
		list.push(week);
		decadeMap.set(year, list);
		byDecade.set(decade, decadeMap);
	}

	return [...byDecade.entries()]
		.sort(([a], [b]) => a - b)
		.map(([decade, yearMap]) => ({
			id: `decade-${decade}`,
			label: `${decade}s`,
			cells: [...yearMap.entries()]
				.sort(([a], [b]) => a - b)
				.map(([year, yearWeeks]) => toCell(`year-${year}`, String(year), yearWeeks))
		}));
};

export const buildDecadeGrid = (weeks: LifeWeekCell[], period: LifePeriod): LifeGridRow[] => {
	const { fromYear, toYear } = periodYearRange(period);
	const byDecade = new Map<number, LifeWeekCell[]>();

	for (const week of weeks) {
		const year = displayYearForWeek(week.week_start, period.from);
		if (year < fromYear || year > toYear) continue;
		const decade = Math.floor(year / 10) * 10;
		const list = byDecade.get(decade) ?? [];
		list.push(week);
		byDecade.set(decade, list);
	}

	return [...byDecade.entries()]
		.sort(([a], [b]) => a - b)
		.map(([decade, decadeWeeks]) => ({
			id: `decade-row-${decade}`,
			label: `${decade}s`,
			cells: [toCell(`decade-${decade}`, `${decade}s`, decadeWeeks)]
		}));
};

export const buildLifeGrid = (
	scale: LifeScale,
	weeks: LifeWeekCell[],
	period: LifePeriod,
	language: Locale = 'ru'
): LifeGridRow[] => {
	switch (scale) {
		case 'month':
			return buildMonthGrid(weeks, period, language);
		case 'year':
			return buildYearGrid(weeks, period);
		case 'decade':
			return buildDecadeGrid(weeks, period);
		default:
			return weekScaleGrid(weeks, period);
	}
};

export const cellBucketKey = (cell: LifeGridCell, scale: LifeScale): string => {
	switch (scale) {
		case 'week':
			return cell.navigateWeek ?? cell.id;
		case 'month':
			return cell.id.replace('month-', '');
		case 'year':
			return cell.id.replace('year-', '');
		case 'decade':
			return cell.label;
	}
};

export const cellHasFill = (cell: LifeGridCell, filled: Set<string>, scale: LifeScale): boolean =>
	filled.has(cellBucketKey(cell, scale));

export const resolveCellAction = (cell: LifeGridCell, scale: LifeScale): LifeUrlInput | null => {
	if (cell.empty) return null;

	switch (scale) {
		case 'decade': {
			const decade = Number(cell.label.replace('s', ''));
			return { ...decadeBounds(decade), scale: 'year' };
		}
		case 'year': {
			const year = Number(cell.label);
			return { ...calendarYearBounds(year), scale: 'month' };
		}
		case 'month': {
			const yearMonth = cell.id.replace('month-', '');
			return { ...calendarMonthBounds(yearMonth), scale: 'week' };
		}
		default:
			return null;
	}
};
