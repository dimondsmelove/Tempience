import { horizonDateISO } from './horizon';
import { addDaysISO } from '../temporal/week-zone';
import type { LifeWeekCell } from '../schemas/life-map';

/** ISO date YYYY-MM-DD → Monday of that ISO week (UTC noon anchor). */
export const weekStartISO = (dateISO: string): string => {
	const d = new Date(`${dateISO}T12:00:00.000Z`);
	const day = d.getUTCDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setUTCDate(d.getUTCDate() + diff);
	return d.toISOString().slice(0, 10);
};

export type { LifeWeekCell };

export const weekRangeUtc = (
	fromWeek: string,
	toWeek: string
): { from: string; to: string } => ({
	from: `${fromWeek}T00:00:00.000Z`,
	to: `${addDaysISO(toWeek, 7)}T00:00:00.000Z`
});

/** Open-ended datetime interval overlaps [rangeFrom, rangeTo) instants. */
export const instantRangeOverlaps = (
	startAt: string | null | undefined,
	endAt: string | null | undefined,
	rangeFrom: string,
	rangeTo: string
): boolean => {
	const entityStart = startAt ? new Date(startAt).getTime() : Number.NEGATIVE_INFINITY;
	const entityEnd = endAt ? new Date(endAt).getTime() : Number.POSITIVE_INFINITY;
	const rangeStart = new Date(rangeFrom).getTime();
	const rangeEnd = new Date(rangeTo).getTime();
	return entityStart < rangeEnd && rangeStart < entityEnd;
};

const birthYearFromDate = (birthDate: string): number => Number(birthDate.slice(0, 4));

export const buildLifeWeeks = (input: {
	birthDate: string;
	horizonDate: string;
	currentWeekStart: string;
	fromWeek?: string;
	toWeek?: string;
}): LifeWeekCell[] => {
	const gridFrom = weekStartISO(input.birthDate);
	const gridTo = weekStartISO(input.horizonDate);
	const fromWeek = input.fromWeek ?? gridFrom;
	const toWeek = input.toWeek ?? gridTo;
	const birthYear = birthYearFromDate(input.birthDate);

	const weeks: LifeWeekCell[] = [];
	let week = gridFrom;
	let ageInWeeks = 0;
	let yearCursor = birthYear;
	let weekIndexInYear = 0;

	while (week <= gridTo) {
		const weekYear = Number(week.slice(0, 4));
		if (weekYear > yearCursor) {
			yearCursor = weekYear;
			weekIndexInYear = 0;
		}

		if (week >= fromWeek && week <= toWeek) {
			weeks.push({
				week_start: week,
				age_in_weeks: ageInWeeks,
				year_index: weekYear - birthYear,
				week_index_in_year: weekIndexInYear,
				is_current: week === input.currentWeekStart,
				is_past: week < input.currentWeekStart,
				is_future: week > input.currentWeekStart
			});
		}

		week = addDaysISO(week, 7);
		ageInWeeks += 1;
		weekIndexInYear += 1;
	}

	return weeks;
};

export const resolveLifeMapWeekRange = (input: {
	birthDate: string;
	lifeHorizonYears: number;
	from?: string;
	to?: string;
}): { fromWeek: string; toWeek: string; horizonDate: string } => {
	const horizonDate = horizonDateISO(input.birthDate, input.lifeHorizonYears);
	const gridFrom = weekStartISO(input.birthDate);
	const gridTo = weekStartISO(horizonDate);

	let fromWeek = input.from ? weekStartISO(input.from) : gridFrom;
	let toWeek = input.to ? weekStartISO(input.to) : gridTo;

	if (fromWeek < gridFrom) fromWeek = gridFrom;
	if (toWeek > gridTo) toWeek = gridTo;
	if (fromWeek > toWeek) {
		const swap = fromWeek;
		fromWeek = toWeek;
		toWeek = swap;
	}

	return { fromWeek, toWeek, horizonDate };
};
