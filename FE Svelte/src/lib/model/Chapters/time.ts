import { formatDay, formatMoment as formatMomentIn } from '$lib/state/Locale/format';
import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';

/**
 * Chapter boundaries are set and read on a zone's wall clock. The zone is always an argument:
 * callers pass the browser's own (`browserTimeZone`), as records and Periods do.
 */

type ZonedParts = Readonly<{
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	weekday: number;
}>;

const partsFormat = new Map<string, Intl.DateTimeFormat>();
const formatFor = (timeZone: string): Intl.DateTimeFormat => {
	let format = partsFormat.get(timeZone);
	if (!format) {
		format = new Intl.DateTimeFormat('en-US', {
			timeZone,
			hourCycle: 'h23',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			weekday: 'short'
		});
		partsFormat.set(timeZone, format);
	}
	return format;
};
const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6
};

/** The browser's own zone: the one records and Periods are written in. */
export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** An ISO instant as ms. */
export const ms = (iso: string): number => Date.parse(iso);

/** The wall clock of an instant in a zone. */
export const zonedParts = (at: number, timeZone: string): ZonedParts => {
	const parts = formatFor(timeZone).formatToParts(new Date(at));
	const get = (type: Intl.DateTimeFormatPartTypes): string =>
		parts.find((part) => part.type === type)?.value ?? '0';
	return {
		year: Number(get('year')),
		month: Number(get('month')),
		day: Number(get('day')),
		hour: Number(get('hour')),
		minute: Number(get('minute')),
		weekday: WEEKDAY_INDEX[get('weekday')] ?? 0
	};
};

/** How far the zone's wall clock runs ahead of UTC at an instant, in ms. */
export const zoneOffsetMs = (at: number, timeZone: string): number => {
	const whole = Math.floor(at / 60_000) * 60_000;
	const p = zonedParts(whole, timeZone);
	return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - whole;
};

/** A wall-clock «YYYY-MM-DDTHH:mm» in the zone, as an instant. */
export const zonedToMs = (local: string, timeZone: string): number | null => {
	const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
	if (!match) return null;
	const [, y, mo, d, h, mi] = match.map(Number);
	const guess = Date.UTC(y, mo - 1, d, h, mi);
	let at = guess - zoneOffsetMs(guess, timeZone);
	const second = zoneOffsetMs(at, timeZone);
	if (guess - second !== at) at = guess - second;
	return at;
};

const pad = (value: number): string => String(value).padStart(2, '0');

/** An instant as the zone's wall clock, for a `datetime-local` input. */
export const msToZoned = (at: number, timeZone: string): string => {
	const p = zonedParts(at, timeZone);
	return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
};

/** An instant as ISO with the zone's offset: `2026-09-28T00:00:00+02:00`. */
export const msToIso = (at: number, timeZone: string): string => {
	const offset = Math.round(zoneOffsetMs(at, timeZone) / 60_000);
	const sign = offset < 0 ? '-' : '+';
	const abs = Math.abs(offset);
	return `${msToZoned(at, timeZone)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
};

/** The next midnight of the zone after an instant. */
export const nextMidnight = (at: number, timeZone: string): number => {
	const p = zonedParts(at, timeZone);
	const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
	const local = `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T00:00`;
	return zonedToMs(local, timeZone) ?? at;
};

/** A chapter's day, through the app's own day format: the year only when it is not this one. */
export const formatDayShort = (
	at: number,
	timeZone: string,
	language: Locale,
	now = Date.now()
): string => formatDay(language, at, { timeZone, year: 'current', now });

/** A chapter's moment, through the app's own format: «пн, 28 сент., 00:00». */
export const formatMoment = (
	at: number,
	timeZone: string,
	language: Locale,
	now = Date.now()
): string => formatMomentIn(language, at, { timeZone, now });

/** «1 сент. – 28 сент.», «10 окт. 2019 – 1 сент. 2020», «с 28 сент.» for an open chapter. */
export const formatSpan = (
	start: number,
	end: number | null,
	timeZone: string,
	language: Locale,
	now = Date.now()
): string =>
	end === null
		? translate(language, 'chapter.spanOpen', {
				start: formatDayShort(start, timeZone, language, now)
			})
		: translate(language, 'chapter.span', {
				start: formatDayShort(start, timeZone, language, now),
				end: formatDayShort(end, timeZone, language, now)
			});
