import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import {
	DAY_MS,
	DAY_STEP_10,
	DAY_STEP_5,
	WEEK_MS,
	monthsFull,
	monthsShort,
	weekdaysShort,
	weekLabelPrefix
} from './constants';
import { axisSpec, type AxisSpecOptions } from './spec';
import type { AxisSpec, AxisTick, AxisUnit, AxisWindow, PeriodRef } from './types';

export { axisSpec, type AxisSpecOptions } from './spec';

const utc = (year: number, month: number, day: number): number => Date.UTC(year, month, day);
const mondayOffset = (d: Date): number => (d.getUTCDay() + 6) % 7;

/** Start of the calendar unit containing `t`. Weeks start on Monday (ISO). */
export const floorUnit = (t: number, unit: AxisUnit): number => {
	const d = new Date(t);
	switch (unit) {
		case 'decade':
			return utc(Math.floor(d.getUTCFullYear() / 10) * 10, 0, 1);
		case 'year':
			return utc(d.getUTCFullYear(), 0, 1);
		case 'month':
			return utc(d.getUTCFullYear(), d.getUTCMonth(), 1);
		case 'week':
			return utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset(d));
		case 'day':
			return utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
	}
};

/** Start of the unit that follows the unit starting at `t`. */
export const nextUnit = (t: number, unit: AxisUnit): number => {
	const d = new Date(t);
	switch (unit) {
		case 'decade':
			return utc(d.getUTCFullYear() + 10, 0, 1);
		case 'year':
			return utc(d.getUTCFullYear() + 1, 0, 1);
		case 'month':
			return utc(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
		case 'week':
			return t + WEEK_MS;
		case 'day':
			return t + DAY_MS;
	}
};

/** Start of the unit that precedes the unit starting at `t`. */
export const prevUnit = (t: number, unit: AxisUnit): number => {
	const d = new Date(t);
	switch (unit) {
		case 'decade':
			return utc(d.getUTCFullYear() - 10, 0, 1);
		case 'year':
			return utc(d.getUTCFullYear() - 1, 0, 1);
		case 'month':
			return utc(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
		case 'week':
			return t - WEEK_MS;
		case 'day':
			return t - DAY_MS;
	}
};

/** The period of `unit` that contains `t`. */
export const periodAt = (t: number, unit: AxisUnit): PeriodRef => {
	const start = floorUnit(t, unit);
	return { unit, start, end: nextUnit(start, unit) };
};

/** ISO-8601 week number: weeks start on Monday, week 1 holds the year's first Thursday. */
export const isoWeek = (t: number): number => {
	const d = new Date(t);
	const thursday = utc(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset(d) + 3);
	const isoYear = new Date(thursday).getUTCFullYear();
	const jan4 = utc(isoYear, 0, 4);
	const week1Monday = jan4 - mondayOffset(new Date(jan4)) * DAY_MS;
	return Math.floor((thursday - week1Monday) / WEEK_MS) + 1;
};

export const pxPerDay = (window: AxisWindow, widthPx: number): number =>
	widthPx / ((window.end - window.start) / DAY_MS);

/** Whether a unit boundary at `t` is labelled for the given calendar-anchored step. */
export const passesStep = (t: number, unit: AxisUnit, step: number): boolean => {
	if (step === 1) return true;
	const d = new Date(t);
	if (unit === 'decade') return Math.floor(d.getUTCFullYear() / 10) % step === 0;
	if (unit === 'year') return d.getUTCFullYear() % step === 0;
	if (unit === 'month') return d.getUTCMonth() % step === 0;
	if (unit === 'week') return isoWeek(t) % step === 0;
	const day = d.getUTCDate();
	if (step === 5) return (DAY_STEP_5 as readonly number[]).includes(day);
	return (DAY_STEP_10 as readonly number[]).includes(day);
};

/** Every boundary of `unit` that touches the window, regardless of step. */
export const unitBoundaries = (window: AxisWindow, unit: AxisUnit): PeriodRef[] => {
	const result: PeriodRef[] = [];
	let t = floorUnit(window.start, unit);
	while (t <= window.end) {
		const end = nextUnit(t, unit);
		result.push({ unit, start: t, end });
		t = end;
	}
	return result;
};

/** The rows the label is drawn among, and the language its words are in. */
export type LabelContext = Readonly<{ spec: AxisSpec; language?: Locale }>;

/**
 * Label for a boundary of `unit`; never repeats what the row above already says. A month in
 * the major row carries its year in January and wherever the row asks for it (`withYear`).
 */
export const tickLabel = (
	t: number,
	unit: AxisUnit,
	context: LabelContext,
	withYear = false
): string => {
	const d = new Date(t);
	const language = context.language ?? 'ru';
	switch (unit) {
		case 'decade':
			return translate(language, 'axis.decade', { year: d.getUTCFullYear() });
		case 'year':
			return String(d.getUTCFullYear());
		case 'month': {
			const name = monthsShort(language)[d.getUTCMonth()];
			return context.spec.major === 'month' && (withYear || d.getUTCMonth() === 0)
				? `${name} ${d.getUTCFullYear()}`
				: name;
		}
		case 'week': {
			const week = `${weekLabelPrefix(language)}${isoWeek(t)}`;
			return context.spec.minor === 'week' && context.spec.weekDate
				? `${week} · ${d.getUTCDate()}`
				: week;
		}
		case 'day':
			return context.spec.weekdays
				? `${weekdaysShort(language)[d.getUTCDay()]} ${d.getUTCDate()}`
				: String(d.getUTCDate());
	}
};

/** Every cell of one axis row inside the window, the stepped ones marked; deterministic at a scale. */
export const axisTicks = (
	window: AxisWindow,
	unit: AxisUnit,
	step: number,
	context: LabelContext
): AxisTick[] =>
	unitBoundaries(window, unit).map((period) => ({
		...period,
		label: tickLabel(period.start, unit, context),
		labelled: passesStep(period.start, unit, step)
	}));

export type AxisRowsOptions = AxisSpecOptions & Readonly<{ language?: Locale }>;

/** Calendar rows for a window; far scales have only a major row. */
export const axisRows = (
	window: AxisWindow,
	widthPx: number,
	options: AxisRowsOptions = {}
): Readonly<{
	spec: AxisSpec;
	ppd: number;
	major: AxisTick[];
	middle: AxisTick[];
	minor: AxisTick[];
}> => {
	const ppd = pxPerDay(window, widthPx);
	const spec = axisSpec(ppd, options);
	const context = { spec, language: options.language ?? 'ru' };
	return {
		spec,
		ppd,
		major: axisTicks(window, spec.major, spec.minor ? 1 : spec.step, context),
		middle: spec.middle ? axisTicks(window, spec.middle, 1, context) : [],
		minor: spec.minor ? axisTicks(window, spec.minor, spec.step, context) : []
	};
};

const dayMonth = (t: number, language: Locale): string => {
	const d = new Date(t);
	return `${d.getUTCDate()} ${monthsShort(language)[d.getUTCMonth()]}`;
};

/** Human title of a period for Context: «Апрель 2026», «Неделя 37 · 7 сен – 13 сен 2026». */
export const periodTitle = (period: PeriodRef, language: Locale = 'ru'): string => {
	const d = new Date(period.start);
	switch (period.unit) {
		case 'decade':
			return translate(language, 'axis.decadeTitle', { year: d.getUTCFullYear() });
		case 'year':
			return translate(language, 'axis.yearTitle', { year: d.getUTCFullYear() });
		case 'month':
			return `${monthsFull(language)[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
		case 'week': {
			const last = period.end - DAY_MS;
			return translate(language, 'axis.weekTitle', {
				week: isoWeek(period.start),
				from: dayMonth(period.start, language),
				to: dayMonth(last, language),
				year: new Date(last).getUTCFullYear()
			});
		}
		case 'day':
			return `${dayMonth(period.start, language)} ${d.getUTCFullYear()}, ${weekdaysShort(language)[d.getUTCDay()]}`;
	}
};
