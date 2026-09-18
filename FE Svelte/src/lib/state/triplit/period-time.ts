import { Temporal } from 'temporal-polyfill';
import { assertCalendarValue, compareCalendarValues } from './trace-time';
import type { PeriodTime, TemporalPrecision } from './types';

const temporalPrecisions = ['minute', 'day', 'month', 'season', 'year'] as const;

type UnknownRecord = Record<string, unknown>;

export type PeriodTimeBounds = {
	start: number;
	end: number;
};

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredString = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
		throw new Error(`${label} must be a non-empty trimmed string`);
	}
	return value;
};

const precisionValue = (value: unknown, label: string): TemporalPrecision => {
	if (typeof value !== 'string' || !temporalPrecisions.includes(value as TemporalPrecision)) {
		throw new Error(`${label} must be one of: ${temporalPrecisions.join(', ')}`);
	}
	return value as TemporalPrecision;
};

export const parsePeriodTime = (value: unknown, label = 'Period time'): PeriodTime => {
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	const unexpected = Object.keys(value).filter(
		(key) => !['precision', 'start', 'end'].includes(key)
	);
	if (unexpected.length > 0) {
		throw new Error(`${label} has unsupported fields: ${unexpected.join(', ')}`);
	}

	const precision = precisionValue(value.precision, `${label}.precision`);
	const start = requiredString(value.start, `${label}.start`);
	const end = requiredString(value.end, `${label}.end`);
	assertCalendarValue(start, precision, `${label}.start`);
	assertCalendarValue(end, precision, `${label}.end`);
	const comparison = compareCalendarValues(start, end, precision);
	if (comparison > 0 || (precision === 'minute' && comparison === 0)) {
		throw new Error(
			precision === 'minute'
				? `${label}.end must be after start`
				: `${label}.end must not be before start`
		);
	}

	return { precision, start, end };
};

export const assertTimeZone = (value: string, label = 'Timezone'): void => {
	if (value.trim().length === 0 || value !== value.trim()) {
		throw new Error(`${label} must be a non-empty trimmed string`);
	}
	try {
		new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
	} catch {
		throw new Error(`${label} must be a valid IANA time zone`);
	}
};

const periodDate = (value: string, precision: Exclude<TemporalPrecision, 'minute'>): string => {
	if (precision === 'year') return `${value}-01-01`;
	if (precision === 'month' || precision === 'season') return `${value}-01`;
	return value;
};

const nextDate = (
	value: string,
	precision: Exclude<TemporalPrecision, 'minute'>
): Temporal.PlainDate => {
	const date = Temporal.PlainDate.from(periodDate(value, precision));
	if (precision === 'year') return date.add({ years: 1 });
	if (precision === 'month' || precision === 'season') return date.add({ months: 1 });
	return date.add({ days: 1 });
};

const localMidnight = (date: string | Temporal.PlainDate, timezone: string): number =>
	Temporal.PlainDate.from(date).toZonedDateTime(timezone).epochMilliseconds;

/** Returns a half-open [start, end) range. Coarse Period ends are inclusive at their precision. */
export const periodTimeBounds = (timeInput: PeriodTime, timezone: string): PeriodTimeBounds => {
	const time = parsePeriodTime(timeInput);
	assertTimeZone(timezone, 'Period timezone');
	if (time.precision === 'minute') {
		return { start: Date.parse(time.start), end: Date.parse(time.end) };
	}

	return {
		start: localMidnight(periodDate(time.start, time.precision), timezone),
		end: localMidnight(nextDate(time.end, time.precision), timezone)
	};
};
