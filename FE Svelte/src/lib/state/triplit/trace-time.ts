import { dateTimeFormat } from '$lib/state/Locale/format';
import type { Locale } from '$lib/state/Locale/types';
import type {
	TemporalPrecision,
	TraceAboutKind,
	TraceAboutTime,
	TraceDuration,
	TraceRelativeTimeRelation
} from './types';
import { parseStatedDuration } from './trace-duration';

export const temporalPrecisions = ['minute', 'day', 'month', 'season', 'year'] as const;
export const relativePrecisions = [...temporalPrecisions, 'unknown'] as const;
export const temporalCertainties = ['exact', 'approximate'] as const;
export const relativeRelations = ['before', 'after', 'during', 'around'] as const;

const MINUTE_MS = 60_000;
const TRACE_SLOT_MS = 30 * MINUTE_MS;
const ISO_TIMESTAMP_PATTERN =
	/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

type UnknownRecord = Record<string, unknown>;

export type TraceExactTimeProjection = {
	aboutAt: string | null;
	aboutStart: string | null;
	aboutEnd: string | null;
};

export type TraceTimeBounds = {
	start: number;
	end: number;
};

const isRecord = (value: unknown): value is UnknownRecord =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

const assertOnlyKeys = (
	value: UnknownRecord,
	allowedKeys: readonly string[],
	label: string
): void => {
	const unexpected = Object.keys(value).filter((key) => !allowedKeys.includes(key));
	if (unexpected.length > 0)
		throw new Error(`${label} has unsupported fields: ${unexpected.join(', ')}`);
};

const enumValue = <T extends string>(value: unknown, values: readonly T[], label: string): T => {
	if (typeof value !== 'string' || !values.includes(value as T)) {
		throw new Error(`${label} must be one of: ${values.join(', ')}`);
	}
	return value as T;
};

const requiredString = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0 || value !== value.trim()) {
		throw new Error(`${label} must be a non-empty trimmed string`);
	}
	return value;
};

const nullableString = (value: unknown, label: string): string | null => {
	if (value === null) return null;
	return requiredString(value, label);
};

const utcTimestamp = (year: number, monthIndex: number, day: number): number => {
	const date = new Date(0);
	date.setUTCHours(0, 0, 0, 0);
	date.setUTCFullYear(year, monthIndex, day);
	return date.getTime();
};

const isValidUtcDate = (year: number, month: number, day: number): boolean => {
	const date = new Date(utcTimestamp(year, month - 1, day));
	return (
		date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
	);
};

export const assertIsoTimestamp = (value: string, label: string): void => {
	const match = ISO_TIMESTAMP_PATTERN.exec(value);
	if (
		!match ||
		!isValidUtcDate(Number(match[1]), Number(match[2]), Number(match[3])) ||
		Number(match[4]) > 23 ||
		Number(match[5]) > 59 ||
		Number(match[6] ?? 0) > 59 ||
		Number.isNaN(Date.parse(value))
	) {
		throw new Error(`${label} must be a valid ISO timestamp with an explicit offset`);
	}
};

export const assertCalendarValue = (
	value: string,
	precision: TemporalPrecision,
	label: string
): void => {
	if (precision === 'minute') {
		assertIsoTimestamp(value, label);
		return;
	}

	if (precision === 'year') {
		if (!/^\d{4}$/.test(value)) throw new Error(`${label} must use YYYY precision`);
		return;
	}

	if (precision === 'month' || precision === 'season') {
		const match = /^(\d{4})-(\d{2})$/.exec(value);
		if (!match || Number(match[2]) < 1 || Number(match[2]) > 12) {
			throw new Error(`${label} must use YYYY-MM precision`);
		}
		return;
	}

	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match || !isValidUtcDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
		throw new Error(`${label} must use a valid YYYY-MM-DD date`);
	}
};

export const calendarValueBounds = (
	value: string,
	precision: TemporalPrecision
): TraceTimeBounds => {
	assertCalendarValue(value, precision, 'Temporal value');
	if (precision === 'minute') {
		const start = Date.parse(value);
		return { start, end: start + MINUTE_MS };
	}
	if (precision === 'year') {
		const year = Number(value);
		return { start: utcTimestamp(year, 0, 1), end: utcTimestamp(year + 1, 0, 1) };
	}
	if (precision === 'month' || precision === 'season') {
		const [year, month] = value.split('-').map(Number);
		return {
			start: utcTimestamp(year, month - 1, 1),
			end: utcTimestamp(year, month, 1)
		};
	}
	const [year, month, day] = value.split('-').map(Number);
	return {
		start: utcTimestamp(year, month - 1, day),
		end: utcTimestamp(year, month - 1, day + 1)
	};
};

export const compareCalendarValues = (
	left: string,
	right: string,
	precision: TemporalPrecision
): number =>
	calendarValueBounds(left, precision).start - calendarValueBounds(right, precision).start;

export const parseTraceAboutTime = (value: unknown, label = 'Trace aboutTime'): TraceAboutTime => {
	if (!isRecord(value)) throw new Error(`${label} must be an object`);
	const basis = enumValue(value.basis, ['absolute', 'relative', 'unknown'], `${label}.basis`);

	if (basis === 'unknown') {
		assertOnlyKeys(value, ['basis'], label);
		return { basis };
	}

	if (basis === 'relative') {
		assertOnlyKeys(value, ['basis', 'precision', 'anchorTraceId', 'relation'], label);
		return {
			basis,
			precision: enumValue(value.precision, relativePrecisions, `${label}.precision`),
			anchorTraceId: requiredString(value.anchorTraceId, `${label}.anchorTraceId`),
			relation: enumValue(
				value.relation,
				relativeRelations,
				`${label}.relation`
			) as TraceRelativeTimeRelation
		};
	}

	assertOnlyKeys(value, ['basis', 'precision', 'certainty', 'start', 'end'], label);
	const precision = enumValue(value.precision, temporalPrecisions, `${label}.precision`);
	const start = requiredString(value.start, `${label}.start`);
	const end = nullableString(value.end, `${label}.end`);
	assertCalendarValue(start, precision, `${label}.start`);
	if (end !== null) {
		assertCalendarValue(end, precision, `${label}.end`);
		if (compareCalendarValues(start, end, precision) > 0) {
			throw new Error(`${label}.end must not be before start`);
		}
	}
	return {
		basis,
		precision,
		certainty: enumValue(value.certainty, temporalCertainties, `${label}.certainty`),
		start,
		end
	};
};

const legacyTraceAboutTime = (
	aboutKind: TraceAboutKind,
	legacy: TraceExactTimeProjection
): TraceAboutTime | null => {
	if (aboutKind === 'trace_ref') return null;
	if (aboutKind === 'instant' && legacy.aboutAt) {
		assertCalendarValue(legacy.aboutAt, 'minute', 'Stored Trace aboutAt');
		return {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: legacy.aboutAt,
			end: null
		};
	}
	if (aboutKind === 'interval' && legacy.aboutStart && legacy.aboutEnd) {
		assertCalendarValue(legacy.aboutStart, 'minute', 'Stored Trace aboutStart');
		assertCalendarValue(legacy.aboutEnd, 'minute', 'Stored Trace aboutEnd');
		return {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: legacy.aboutStart,
			end: legacy.aboutEnd
		};
	}
	return { basis: 'unknown' };
};

export const normalizeStoredTraceAboutTime = (
	value: unknown,
	aboutKind: TraceAboutKind,
	legacy: TraceExactTimeProjection
): TraceAboutTime | null =>
	value === undefined
		? legacyTraceAboutTime(aboutKind, legacy)
		: value === null
			? null
			: parseTraceAboutTime(value);

export const assertTraceTemporalPlacement = (
	aboutKind: TraceAboutKind,
	aboutTime: TraceAboutTime | null,
	aboutTraceId: string | null,
	statedDuration: TraceDuration | null = null
): void => {
	if (!['instant', 'interval', 'trace_ref'].includes(aboutKind)) {
		throw new Error('Trace aboutKind must be instant, interval, or trace_ref');
	}
	if (statedDuration) {
		parseStatedDuration(statedDuration);
		if (aboutKind !== 'interval') throw new Error('A stated duration requires an interval Trace');
	}
	if (aboutKind === 'trace_ref') {
		if (aboutTime !== null) throw new Error('Trace reference placement cannot also have aboutTime');
		// Legacy inline references carry aboutTraceId; a new supplement carries none and is
		// anchored by its revisits link, checked across records by the saving command.
		if (aboutTraceId !== null && aboutTraceId.trim().length === 0) {
			throw new Error('Trace reference placement requires aboutTraceId');
		}
		return;
	}

	if (aboutTraceId !== null) throw new Error('Temporal Trace placement cannot have aboutTraceId');
	if (aboutTime === null) throw new Error(`Trace ${aboutKind} placement requires aboutTime`);
	if (aboutTime.basis !== 'absolute') return;
	if (statedDuration) {
		// With an amount, this evidence locates the start, including its uncertainty window.
		if (
			aboutTime.end !== null &&
			aboutTime.certainty === 'exact' &&
			aboutTime.precision !== 'season'
		)
			throw new Error('Explicit interval boundaries cannot also have a stated duration');
		if (aboutTime.precision === 'season' && aboutTime.end === null)
			throw new Error('Season precision requires a normalized start/end month window');
		return;
	}

	if (aboutKind === 'interval') {
		if (aboutTime.end === null) throw new Error('Trace interval placement requires aboutTime.end');
		if (
			aboutTime.precision === 'minute' &&
			compareCalendarValues(aboutTime.start, aboutTime.end, aboutTime.precision) >= 0
		) {
			throw new Error('Trace interval placement must end after it starts');
		}
		return;
	}

	if (
		aboutTime.certainty === 'exact' &&
		aboutTime.precision !== 'season' &&
		aboutTime.end !== null
	) {
		throw new Error('Exact instant placement cannot have an uncertainty window');
	}
	if (aboutTime.precision === 'season' && aboutTime.end === null) {
		throw new Error('Season precision requires a normalized start/end month window');
	}
};

export const exactTraceTimeProjection = (
	aboutKind: TraceAboutKind,
	aboutTime: TraceAboutTime | null
): TraceExactTimeProjection => {
	const empty = { aboutAt: null, aboutStart: null, aboutEnd: null };
	if (
		aboutTime?.basis !== 'absolute' ||
		aboutTime.precision !== 'minute' ||
		aboutTime.certainty !== 'exact'
	) {
		return empty;
	}
	if (aboutKind === 'instant') {
		return { ...empty, aboutAt: new Date(aboutTime.start).toISOString() };
	}
	if (aboutKind === 'interval' && aboutTime.end !== null) {
		return {
			aboutAt: null,
			aboutStart: new Date(aboutTime.start).toISOString(),
			aboutEnd: new Date(aboutTime.end).toISOString()
		};
	}
	return empty;
};

export const traceAboutTimeBounds = (
	aboutKind: TraceAboutKind,
	aboutTime: TraceAboutTime | null,
	statedDuration: TraceDuration | null = null
): TraceTimeBounds | null => {
	if (aboutKind === 'trace_ref' || aboutTime?.basis !== 'absolute') return null;
	const start = calendarValueBounds(aboutTime.start, aboutTime.precision);
	if (aboutKind === 'interval' && !statedDuration) {
		if (aboutTime.end === null) return null;
		const end = calendarValueBounds(aboutTime.end, aboutTime.precision);
		return {
			start: start.start,
			end: aboutTime.precision === 'minute' ? end.start : end.end
		};
	}
	if (aboutTime.end !== null) {
		return {
			start: start.start,
			end: calendarValueBounds(aboutTime.end, aboutTime.precision).end
		};
	}
	return {
		start: start.start,
		end: aboutTime.precision === 'minute' ? start.start + TRACE_SLOT_MS : start.end
	};
};

export const temporalValueDateISO = (value: string, precision: TemporalPrecision): string => {
	const bounds = calendarValueBounds(value, precision);
	return new Date(bounds.start).toISOString().slice(0, 10);
};

export const formatTemporalValue = (
	value: string,
	precision: TemporalPrecision,
	language: Locale = 'ru'
): string => {
	if (precision === 'year') return value;
	const date = new Date(calendarValueBounds(value, precision).start);
	if (precision === 'minute') {
		return dateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
	}
	if (precision === 'month' || precision === 'season') {
		return dateTimeFormat(language, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
			date
		);
	}
	return dateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(date);
};
