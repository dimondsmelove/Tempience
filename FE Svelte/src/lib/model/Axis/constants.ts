import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
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

/** Close scales retain their calendar rows; far scales use readable label widths below. */
export const AXIS_BANDS = Object.freeze({
	MONTH_WEEKS: 1.6,
	WEEKS_DAYS: 7,
	WEEKDAYS: 40
});

/** Minimum horizontal room a minor label needs, in pixels. */
export const MIN_LABEL_PX = 22;
/** Room needed before a week label also shows the Monday date. */
export const WEEK_DATE_LABEL_PX = 64;
/** Candidate day-label steps, anchored to the first of the month; every day keeps a tick. */
/** Room for a week label such as «н42» at the baseline axis text size. */
export const WEEK_LABEL_PX = 24;
export const WEEK_STEPS = [1, 2, 4] as const;
export const DAY_STEPS = [1, 5, 10] as const;
export const DAY_STEP_5 = [1, 5, 10, 15, 20, 25] as const;
export const DAY_STEP_10 = [1, 10, 20] as const;

/** Horizontal room including padding, at the baseline axis text size. */
export const MONTH_LABEL_PX = 32;
export const YEAR_LABEL_PX = 48;
export const DECADE_LABEL_PX = 64;
export const DECADE_STEPS = [1, 2, 5, 10] as const;
