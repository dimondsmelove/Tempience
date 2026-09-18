import { dateTimeFormat } from '$lib/state/Locale/format';
import type { Locale } from '$lib/state/Locale/types';
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WHEEL_ROW_PX = 44;
export const WHEEL_DAY_RADIUS = 62;
export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const months = new Map<Locale, readonly string[]>();
/** The twelve month names of a language, built once per language. */
export const monthNames = (language: Locale): readonly string[] => {
	let names = months.get(language);
	if (!names)
		months.set(
			language,
			(names = Array.from({ length: 12 }, (_, i) =>
				dateTimeFormat(language, { month: 'long' }).format(new Date(2026, i, 1))
			))
		);
	return names;
};
