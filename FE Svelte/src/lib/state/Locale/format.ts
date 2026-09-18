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

/** A calendar day (a UTC instant) as the language writes it, without the Russian «г.». */
export const formatDay = (locale: Locale, ms: number): string =>
	dateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
		.format(ms)
		.replace(' г.', '');
