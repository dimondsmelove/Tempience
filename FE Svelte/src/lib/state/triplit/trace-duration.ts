import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { Trace, TraceDuration } from './types';

export function parseStatedDuration(value: unknown): TraceDuration | null {
	if (value === undefined || value === null) return null;
	if (typeof value !== 'object' || Array.isArray(value))
		throw new Error('Trace statedDuration must be an amount and unit');
	const record = value as Record<string, unknown>;
	if (
		Object.keys(record).some((key) => key !== 'amount' && key !== 'unit') ||
		!Number.isSafeInteger(record.amount) ||
		(record.amount as number) <= 0 ||
		(record.unit !== 'minute' && record.unit !== 'day')
	)
		throw new Error('Trace statedDuration requires a positive integer in minutes or calendar days');
	return { amount: record.amount as number, unit: record.unit };
}

export function traceDuration(
	trace: Pick<Trace, 'aboutKind' | 'aboutTime' | 'statedDuration'>
): TraceDuration | null {
	if (trace.statedDuration) return trace.statedDuration;
	const time = trace.aboutTime;
	if (
		trace.aboutKind !== 'interval' ||
		time?.basis !== 'absolute' ||
		time.certainty !== 'exact' ||
		time.end === null
	)
		return null;
	if (time.precision === 'day')
		return {
			amount: (Date.parse(time.end) - Date.parse(time.start)) / 86_400_000 + 1,
			unit: 'day'
		};
	return time.precision === 'minute'
		? { amount: (Date.parse(time.end) - Date.parse(time.start)) / 60_000, unit: 'minute' }
		: null;
}

/** A stated amount as the interface abbreviates it, in the given language. */
export function formatTraceDuration(value: TraceDuration, language: Locale = 'ru'): string {
	if (value.unit === 'day') return translate(language, 'time.daysShort', { count: value.amount });
	const hours = Math.floor(value.amount / 60);
	const minutes = value.amount % 60;
	const h = translate(language, 'time.hoursShort', { count: hours });
	const m = translate(language, 'time.minutesShort', { count: minutes });
	return hours ? `${h}${minutes ? ` ${m}` : ''}` : m;
}
