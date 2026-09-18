import { t } from '$lib/state/Locale/Locale.svelte';
import { MINUTE } from './constants';
import type { DurationAmount, TimeSelection } from './types';

export function measuredMinutes(value: TimeSelection): number | null {
	return value.timed && !value.window && !value.approximate && value.end !== null
		? Math.round((value.end - value.start) / MINUTE)
		: null;
}

export function measuredAmount(minutes: number): DurationAmount {
	return minutes % 60 === 0
		? { amount: minutes / 60, unit: 'hour' }
		: { amount: minutes, unit: 'minute' };
}

export function measuredDuration(value: TimeSelection): DurationAmount | null {
	const minutes = measuredMinutes(value);
	if (minutes !== null) return measuredAmount(minutes);
	if (value.date || value.window || value.approximate || value.timed || value.end === null)
		return null;
	const day = (t: number) => {
		const d = new Date(t);
		return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
	};
	return { amount: (day(value.end) - day(value.start)) / 86_400_000 + 1, unit: 'day' };
}

export function matchesAmount(a: DurationAmount, b: DurationAmount): boolean {
	if (a.unit === 'day' || b.unit === 'day') return a.unit === b.unit && a.amount === b.amount;
	return a.amount * (a.unit === 'hour' ? 60 : 1) === b.amount * (b.unit === 'hour' ? 60 : 1);
}

/** An amount as the interface abbreviates it, in the language of the moment. */
export function amountLabel(value: DurationAmount): string {
	if (value.unit === 'minute' && value.amount >= 60) {
		const minutes = value.amount % 60;
		return `${t('time.hoursShort', { count: Math.floor(value.amount / 60) })}${minutes ? ` ${t('time.minutesShort', { count: minutes })}` : ''}`;
	}
	const key = {
		minute: 'time.minutesShort',
		hour: 'time.hoursShort',
		day: 'time.daysShort'
	} as const;
	return t(key[value.unit], { count: value.amount });
}

export function matchesMinutes(value: DurationAmount, minutes: number): boolean {
	// A stated calendar-day amount does not imply a fixed number of elapsed hours.
	return value.unit !== 'day' && value.amount * (value.unit === 'hour' ? 60 : 1) === minutes;
}
