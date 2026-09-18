import type { TemporalPlacement } from './types';
import type { TemporalPrecision } from '$lib/state/triplit/types';
import { assertTraceTemporalPlacement, parseTraceAboutTime } from '$lib/state/triplit/trace-time';
import { parseStatedDuration } from '$lib/state/triplit/trace-duration';
import { dayAt } from '$lib/ui/TimeInput/TimeInput';
import { matchesAmount } from '$lib/ui/TimeInput/duration';
import type { TimeSelection } from '$lib/ui/TimeInput/types';

function coordinate(value: string, precision: TemporalPrecision): number {
	if (precision === 'minute') return Date.parse(value);
	const day =
		precision === 'year'
			? `${value}-01-01`
			: precision === 'month' || precision === 'season'
				? `${value}-01`
				: value;
	return Date.parse(`${day}T12:00:00`);
}
function calendarValue(value: number, precision: TemporalPrecision): string {
	const d = new Date(value);
	if (precision === 'minute') return d.toISOString();
	const year = String(d.getFullYear()).padStart(4, '0');
	const month = `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
	return precision === 'year'
		? year
		: precision === 'month' || precision === 'season'
			? month
			: `${month}-${String(d.getDate()).padStart(2, '0')}`;
}
export function selectionFromPlacement(
	placement: TemporalPlacement,
	now = Date.now()
): TimeSelection {
	const t = placement.aboutTime;
	const quantity = placement.statedDuration;
	return {
		start: t?.basis === 'absolute' ? coordinate(t.start, t.precision) : dayAt(now),
		end: t?.basis === 'absolute' && t.end !== null ? coordinate(t.end, t.precision) : null,
		timed: t?.basis === 'absolute' && t.precision === 'minute',
		...(quantity ? { duration: quantity } : {}),
		date:
			t?.basis === 'absolute'
				? t.precision === 'minute' || t.precision === 'day'
					? undefined
					: t.precision
				: t?.basis === 'unknown'
					? 'unknown'
					: 'preserved',
		approximate: t?.basis === 'absolute' && t.certainty === 'approximate',
		window:
			t?.basis === 'absolute' &&
			t.end !== null &&
			(Boolean(quantity) || placement.aboutKind === 'instant')
	};
}
export function sameSelection(a: TimeSelection, b: TimeSelection): boolean {
	return (
		a.start === b.start &&
		a.end === b.end &&
		a.timed === b.timed &&
		a.date === b.date &&
		Boolean(a.approximate) === Boolean(b.approximate) &&
		Boolean(a.window) === Boolean(b.window) &&
		(a.duration && b.duration ? matchesAmount(a.duration, b.duration) : a.duration === b.duration)
	);
}
export function placementFromSelection(
	selection: TimeSelection,
	original: TemporalPlacement
): TemporalPlacement {
	const d = selection.duration;
	const statedDuration = parseStatedDuration(
		d
			? {
					amount: d.amount * (d.unit === 'hour' ? 60 : 1),
					unit: d.unit === 'day' ? 'day' : 'minute'
				}
			: null
	);
	let result: TemporalPlacement;
	if (selection.date === 'preserved') {
		result = {
			...original,
			statedDuration,
			aboutKind: statedDuration ? 'interval' : original.aboutKind
		};
	} else if (selection.date === 'unknown') {
		result = {
			aboutKind: statedDuration ? 'interval' : 'instant',
			aboutTime: { basis: 'unknown' },
			aboutTraceId: null,
			statedDuration
		};
	} else {
		const precision = selection.date ?? (selection.timed ? 'minute' : 'day');
		result = {
			aboutKind:
				statedDuration || (selection.end !== null && !selection.window) ? 'interval' : 'instant',
			aboutTime: parseTraceAboutTime({
				basis: 'absolute',
				precision,
				certainty: selection.approximate ? 'approximate' : 'exact',
				start: calendarValue(selection.start, precision),
				end: selection.end === null ? null : calendarValue(selection.end, precision)
			}),
			aboutTraceId: null,
			statedDuration
		};
	}
	assertTraceTemporalPlacement(
		result.aboutKind,
		result.aboutTime,
		result.aboutTraceId,
		result.statedDuration
	);
	return result;
}
