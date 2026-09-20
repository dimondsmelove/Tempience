import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { AxisBand, LabelWidths } from './types';
export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

const names = new Map<string, readonly string[]>();
/** A comma-joined list of the catalogs, split once per language: the axis draws thousands of labels. */
const namesOf = (language: Locale, key: 'axis.months' | 'axis.monthsFull' | 'axis.weekdays') => {
	const id = `${language}|${key}`;
	let list = names.get(id);
	if (!list) names.set(id, (list = translate(language, key).split(',')));
	return list;
};
export const monthsShort = (language: Locale): readonly string[] =>
	namesOf(language, 'axis.months');
export const monthsFull = (language: Locale): readonly string[] =>
	namesOf(language, 'axis.monthsFull');
/** Indexed by `Date#getUTCDay()`: Sunday first. */
export const weekdaysShort = (language: Locale): readonly string[] =>
	namesOf(language, 'axis.weekdays');

/** ISO week labels read as «н37» / «w37». */
export const weekLabelPrefix = (language: Locale): string => translate(language, 'axis.weekPrefix');

/** Rows from the farthest scale to the closest; neighbours in this list share a threshold. */
export const AXIS_BAND_ORDER: readonly AxisBand[] = [
	'decades',
	'years',
	'months',
	'weeks',
	'days',
	'weekdays'
];

/** Close scales retain their calendar rows; far scales follow the label widths below. */
export const AXIS_BANDS = Object.freeze({
	MONTH_WEEKS: 1.6,
	WEEKS_DAYS: 7,
	WEEKDAYS: 40
});

/** A band switches only once the scale is this far beyond its threshold (DR 008 v4, п. 2). */
export const BAND_HYSTERESIS = 0.04;

/** Room a label takes beyond its text: 6 px on each side. */
export const LABEL_PADDING_PX = 12;
/** A label starts this far after its cell boundary. */
export const LABEL_INSET_PX = 6;
/** The label of the cell cut by the left edge is pinned here on a plate. */
export const PIN_X_PX = 4;

/**
 * Text widths of the widest labels at the baseline axis fonts (12 px 600 major, 11 px minor,
 * Geist Mono). The drawing passes live measurements; these serve the model on its own.
 */
export const LABEL_WIDTHS: LabelWidths = Object.freeze({
	decade: 42,
	year: 28,
	month: 21,
	week: 21,
	weekDate: 56,
	day: 14,
	weekday: 35
});

/** The shortest cell of each unit, in days: the label step must fit the shortest cell. */
export const MIN_UNIT_DAYS = Object.freeze({ decade: 3650, year: 365, month: 28, week: 7, day: 1 });

/** Candidate label steps per unit, anchored to the calendar; every cell keeps its tick. */
export const DECADE_STEPS = [1, 2, 5, 10] as const;
export const YEAR_STEPS = [1, 2, 5] as const;
export const MONTH_STEPS = [1, 2, 3, 6] as const;
export const WEEK_STEPS = [1, 2, 4] as const;
export const DAY_STEPS = [1, 5, 10] as const;
export const DAY_STEP_5 = [1, 5, 10, 15, 20, 25] as const;
export const DAY_STEP_10 = [1, 10, 20] as const;
