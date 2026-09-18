import { dateTimeFormat } from '$lib/state/Locale/format';
import { locale, t } from '$lib/state/Locale/Locale.svelte';
import { clampWindow, spanOf } from '$lib/state/Viewport/math';
import type { TimeWindow } from '$lib/state/Viewport/types';
import { DAY, HOUR, MINUTE } from './constants';
import { amountLabel } from './duration';
import type { RailMode, RailTick, TimeSelection } from './types';

// Every label reads the language of the moment: a template that shows one follows a switch.
export function dayAt(t: number): number {
	const d = new Date(t);
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12).getTime();
}
export function addDays(t: number, days: number): number {
	const d = new Date(t);
	d.setDate(d.getDate() + days);
	return d.getTime();
}
export function clockLabel(t: number): string {
	return dateTimeFormat(locale.current, {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(t);
}
export function dateLabel(t: number): string {
	return dateTimeFormat(locale.current, { day: 'numeric', month: 'long' }).format(t);
}
export function rangeLabel(value: TimeSelection): string {
	const point = (t: number) => `${dateLabel(t)}${value.timed ? ', ' + clockLabel(t) : ''}`;
	if (value.duration) return `${point(value.start)} · ${amountLabel(value.duration)}`;
	return value.end === null ? point(value.start) : `${point(value.start)} → ${point(value.end)}`;
}
export function selectionDateLabel(value: TimeSelection, point: number): string {
	if (value.date === 'unknown') return t('time.dateUnknown');
	if (value.date === 'preserved') return t('time.preserved');
	if (value.date)
		return dateTimeFormat(locale.current, {
			year: 'numeric',
			...(value.date === 'year' ? {} : { month: 'long' as const })
		}).format(point);
	return dateLabel(point);
}
export function durationLabel(value: TimeSelection): string {
	if (value.duration) return amountLabel(value.duration);
	if (value.end === null || !value.timed || value.window || value.approximate) return '';
	const minutes = Math.round((value.end - value.start) / MINUTE);
	const hours = Math.floor(minutes / 60);
	return [
		hours ? t('time.hoursShort', { count: hours }) : '',
		minutes % 60 ? t('time.minutesShort', { count: minutes % 60 }) : ''
	]
		.filter(Boolean)
		.join(' ');
}
export function windowAt(t: number, mode: RailMode): TimeWindow {
	const span = mode === 'day' ? 7 * DAY : 12 * HOUR;
	return { start: t - span / 2, end: t + span / 2 };
}
export function limitWindow(window: TimeWindow, mode: RailMode): TimeWindow {
	return clampWindow(window, {
		minSpanMs: mode === 'day' ? 3 * DAY : 30 * MINUTE,
		maxSpanMs: mode === 'day' ? 62 * DAY : 3 * DAY,
		minStart: new Date(1900, 0, 1).getTime(),
		maxEnd: new Date(2200, 0, 1).getTime()
	});
}
export function stepAt(window: TimeWindow, width: number, mode: RailMode): number {
	if (mode === 'day') return DAY;
	const minutes = spanOf(window) / MINUTE;
	return (minutes <= 90 ? 1 : minutes <= 360 ? 5 : 15) * MINUTE;
}
export function snapped(t: number, mode: RailMode, step: number): number {
	return mode === 'day' ? dayAt(t) : Math.round(t / step) * step;
}
export function shiftSelection(
	value: TimeSelection,
	target: number,
	mode: RailMode
): TimeSelection {
	if (mode === 'day') {
		const date = new Date(target);
		const start = new Date(value.start);
		const days =
			(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) -
				Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) /
			DAY;
		return {
			...value,
			start: addDays(value.start, days),
			end: value.end === null ? null : addDays(value.end, days)
		};
	}
	return {
		...value,
		start: target,
		end: value.end === null ? null : value.end + target - value.start
	};
}
export function changeEnd(value: TimeSelection, target: number, mode: RailMode): TimeSelection {
	let end = target;
	if (mode === 'day' && value.timed) {
		const d = new Date(target),
			clock = new Date(value.end ?? value.start);
		end = new Date(
			d.getFullYear(),
			d.getMonth(),
			d.getDate(),
			clock.getHours(),
			clock.getMinutes()
		).getTime();
	}
	return { ...value, end: Math.max(value.start + (value.timed ? MINUTE : 0), end) };
}
export function changeStart(value: TimeSelection, target: number, mode: RailMode): TimeSelection {
	const moved = shiftSelection({ ...value, end: null }, target, mode);
	return {
		...value,
		start:
			value.end === null
				? moved.start
				: Math.min(value.end - (value.timed ? MINUTE : 0), moved.start)
	};
}
export function withClock(value: TimeSelection, hours: number, minutes: number): TimeSelection {
	const start = new Date(value.start);
	start.setHours(hours, minutes, 0, 0);
	return { ...shiftSelection(value, start.getTime(), 'minute'), timed: true };
}
export function dayWindow(t: number): TimeWindow {
	const d = new Date(t);
	const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
	return { start, end: addDays(start, 1) };
}
export function ticks(window: TimeWindow, width: number, mode: RailMode): RailTick[] {
	const result: RailTick[] = [];
	if (mode === 'day') {
		const step = Math.max(1, Math.ceil(spanOf(window) / DAY / Math.max(3, width / 44)));
		for (
			let t = dayAt(window.start);
			t <= window.end;
			t = addDays(t, Math.max(1, Math.ceil(spanOf(window) / DAY / 200)))
		) {
			const major = new Date(t).getDate() % step === 0;
			result.push({
				value: t,
				major,
				label: major ? String(new Date(t).getDate()) : '',
				detail: major ? dateTimeFormat(locale.current, { weekday: 'short' }).format(t) : ''
			});
		}
	} else {
		const minutes = spanOf(window) / MINUTE;
		const major =
			[5, 10, 15, 30, 60, 120, 180, 360, 720].find((n) => n >= minutes / Math.max(3, width / 70)) ??
			720;
		const minor = [1, 5, 15, 30, 60].find((n) => n >= minutes / Math.max(3, width / 10)) ?? 60;
		const midnight = dayWindow(window.start).start;
		for (
			let t = midnight + Math.ceil((window.start - midnight) / (minor * MINUTE)) * minor * MINUTE;
			t <= window.end;
			t += minor * MINUTE
		) {
			const labelled = Math.round((t - midnight) / MINUTE) % major === 0;
			result.push({
				value: t,
				major: labelled,
				label: labelled ? (t === dayWindow(window.start).end ? '24:00' : clockLabel(t)) : '',
				detail: ''
			});
		}
	}
	return result;
}
