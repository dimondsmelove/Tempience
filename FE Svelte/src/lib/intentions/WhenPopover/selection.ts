import { Temporal } from 'temporal-polyfill';
import type { WhenChoice, WhenView } from '../WhenModel/types';
import { localDateValue } from '$lib/ui/DateInput/DateInput';

export type WhenQuickPick = 'today' | 'tomorrow' | 'week' | 'undated' | null;
export type WhenQuickChoice = Exclude<WhenQuickPick, null>;

export function whenChoiceForQuickPick(pick: WhenQuickChoice): WhenChoice {
	return pick === 'today'
		? { kind: 'today' }
		: pick === 'tomorrow'
			? { kind: 'tomorrow' }
			: pick === 'week'
				? { kind: 'week' }
				: { kind: 'undated' };
}

export function whenChoiceForDay(date: Date): WhenChoice {
	return { kind: 'day', dayKey: localDateValue(date) };
}

export function dayKeyInZone(instant: number, zone: string): string {
	return Temporal.Instant.fromEpochMilliseconds(instant)
		.toZonedDateTimeISO(zone)
		.toPlainDate()
		.toString();
}

export function activeWhenQuickPick(
	view: WhenView,
	todayKey: string,
	weekStart: number,
	zone: string
): WhenQuickPick {
	if (view.placement === 'undated') return 'undated';
	if (view.placement === 'week') {
		return view.weekStart === dayKeyInZone(weekStart, zone) ? 'week' : null;
	}
	if (view.placement !== 'day' || !view.dayKey) return null;
	if (view.dayKey === todayKey) return 'today';
	if (view.dayKey === Temporal.PlainDate.from(todayKey).add({ days: 1 }).toString())
		return 'tomorrow';
	return null;
}
