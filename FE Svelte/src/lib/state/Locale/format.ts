import type { Locale } from './types';

/** The BCP 47 tag each interface language formats numbers and dates with. */
export const LOCALE_TAGS: Record<Locale, string> = { ru: 'ru-RU', en: 'en-GB' };

const dateFormats = new Map<string, Intl.DateTimeFormat>();
const numberFormats = new Map<string, Intl.NumberFormat>();

/**
 * A date formatter of the language, built once per set of options: building one costs tens
 * of microseconds, and a table page or a hundred thousand records ask for the same few.
 */
export const dateTimeFormat = (
	locale: Locale,
	options: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat => {
	const key = `${locale}|${JSON.stringify(options)}`;
	let format = dateFormats.get(key);
	if (!format)
		dateFormats.set(key, (format = new Intl.DateTimeFormat(LOCALE_TAGS[locale], options)));
	return format;
};

/** A number formatter of the language, built once per set of options. */
export const numberFormat = (
	locale: Locale,
	options: Intl.NumberFormatOptions = { maximumFractionDigits: 20 }
): Intl.NumberFormat => {
	const key = `${locale}|${JSON.stringify(options)}`;
	let format = numberFormats.get(key);
	if (!format)
		numberFormats.set(key, (format = new Intl.NumberFormat(LOCALE_TAGS[locale], options)));
	return format;
};

export type DayOptions = Readonly<{
	/** The zone the day is read in; a calendar day is a UTC instant by default. */
	timeZone?: string;
	/** `current`: the year only when it is not the year of `now` — «10 окт.», «10 окт. 2019». */
	year?: 'always' | 'current';
	now?: number;
}>;

const yearIn = (ms: number, timeZone: string): string =>
	dateTimeFormat('en', { year: 'numeric', timeZone }).format(ms);

/** A calendar day as the language writes it, without the Russian «г.». */
export const formatDay = (locale: Locale, ms: number, options: DayOptions = {}): string => {
	const timeZone = options.timeZone ?? 'UTC';
	const year =
		options.year !== 'current' ||
		yearIn(ms, timeZone) !== yearIn(options.now ?? Date.now(), timeZone);
	return dateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		...(year ? { year: 'numeric' as const } : {}),
		timeZone
	})
		.format(ms)
		.replace(' г.', '');
};

/** A moment as the language writes it: weekday, day, month (a year not this one), time. */
export const formatMoment = (locale: Locale, ms: number, options: DayOptions = {}): string => {
	const timeZone = options.timeZone ?? 'UTC';
	const year = yearIn(ms, timeZone) !== yearIn(options.now ?? Date.now(), timeZone);
	return dateTimeFormat(locale, {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		...(year ? { year: 'numeric' as const } : {}),
		hour: '2-digit',
		minute: '2-digit',
		hourCycle: 'h23',
		timeZone
	})
		.format(ms)
		.replace(' г.', '');
};
