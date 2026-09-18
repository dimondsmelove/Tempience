import { describe, expect, it } from 'vitest';
import {
	changeEnd,
	changeStart,
	dayAt,
	durationLabel,
	shiftSelection,
	withClock
} from './TimeInput';
import { MINUTE } from './constants';

const time = (day: number, hour: number, minute = 0) =>
	new Date(2026, 8, day, hour, minute).getTime();
describe('visual time prototype', () => {
	it('moves a date without assigning a clock time, including a month boundary', () => {
		const value = { start: time(30, 12), end: null, timed: false };
		const moved = shiftSelection(value, new Date(2026, 9, 2).getTime(), 'day');
		expect(moved).toEqual({ start: new Date(2026, 9, 2, 12).getTime(), end: null, timed: false });
	});
	it('moves an event as a whole and preserves its clock when selecting a different day', () => {
		const value = { start: time(9, 14, 30), end: time(9, 16), timed: true };
		const moved = shiftSelection(value, dayAt(time(10, 5)), 'day');
		expect(moved).toEqual({ start: time(10, 14, 30), end: time(10, 16), timed: true });
		expect(durationLabel(moved)).toBe('1 ч 30 мин');
		expect(withClock(moved, 23, 45)).toEqual({
			start: time(10, 23, 45),
			end: time(11, 1, 15),
			timed: true
		});
	});
	it('keeps endpoints ordered when a handle crosses the other edge', () => {
		const value = { start: time(9, 14), end: time(9, 16), timed: true };
		expect(changeEnd(value, time(9, 12), 'minute').end).toBe(value.start + MINUTE);
		expect(changeStart(value, time(9, 18), 'minute').start).toBe(value.end - MINUTE);
	});
	it('does not report a fabricated duration for a selection with only calendar dates', () => {
		expect(durationLabel({ start: time(9, 12), end: time(11, 12), timed: false })).toBe('');
	});
});

import { TimeInputState } from './TimeInputState.svelte';
import { dayWindow, ticks } from './TimeInput';

describe('shared timeline time draft', () => {
	it('keeps an unfinished end and exact clock while switching input methods', () => {
		const initial = { start: time(9, 12), end: null, timed: false };
		const state = new TimeInputState(initial);
		state.open();
		state.clock(18, 37);
		state.beginEnd();
		state.switchInput('timeline');
		expect(state.pickingEnd).toBe(true);
		expect(state.edge).toBe('end');
		expect(state.draft).toEqual({ start: time(9, 18, 37), end: null, timed: true });
		state.switchInput('picker');
		expect(state.pickingEnd).toBe(true);
		state.chooseDay(time(10, 12));
		state.clock(19, 30);
		expect(state.draft).toEqual({ start: time(9, 18, 37), end: time(10, 19, 30), timed: true });
		state.cancel();
		expect(state.value).toEqual(initial);
	});
	it('selects a calendar day without adding time or an optional end', () => {
		const state = new TimeInputState({ start: time(9, 12), end: null, timed: false });
		state.open();
		state.chooseDay(new Date(2026, 10, 9).getTime());
		state.switchInput('timeline');
		state.switchInput('picker');
		state.beginEnd();
		state.cancelEnd();
		state.apply();
		expect(state.value).toEqual({
			start: new Date(2026, 10, 9, 12).getTime(),
			end: null,
			timed: false
		});
	});
	it('sets a cross-day interval by editing each endpoint independently', () => {
		const state = new TimeInputState({ start: time(9, 12), end: null, timed: false });
		state.open();
		state.hours();
		state.clock(10, 0);
		state.beginEnd();
		expect(state.draft.end).toBeNull();
		state.days();
		state.pick(time(10, 12));
		state.hours();
		state.clock(11, 0);
		expect(state.draft).toEqual({ start: time(9, 10), end: time(10, 11), timed: true });
		expect(durationLabel(state.draft)).toBe('25 ч');
		state.focus('start');
		state.clock(9, 30);
		expect(state.draft.end).toBe(time(10, 11));
		expect(state.value.timed).toBe(false);
		state.apply();
		expect(state.value.start).toBe(time(9, 9, 30));
	});
	it('contains hour pan, zoom and selection inside the active calendar day', () => {
		const state = new TimeInputState({ start: time(9, 10), end: time(10, 11), timed: true });
		state.viewport.motionEnabled = false;
		state.open();
		state.focus('end');
		state.hours();
		const bounds = dayWindow(time(10, 11));
		state.windowTo({ start: time(8, 0), end: time(12, 0) });
		expect(state.viewport.window).toEqual(bounds);
		state.pick(time(11, 3));
		expect(state.draft.end).toBe(bounds.end - MINUTE);
		state.pick(time(9, 3));
		expect(state.draft.end).toBe(bounds.start);
	});
	it('cancel preserves the applied value and zoom preserves precision and endpoints', () => {
		const initial = { start: time(9, 12), end: null, timed: false };
		const state = new TimeInputState(initial);
		state.viewport.motionEnabled = false;
		state.open();
		state.zoom(0.625);
		expect(state.draft).toEqual(initial);
		state.hours();
		state.clock(17, 30);
		state.cancel();
		expect(state.value).toEqual(initial);
		expect(state.draft).toEqual(initial);
		expect(state.active).toBe(false);
	});
	it('keeps intermediate hour marks even with sparse labels', () => {
		const bounds = dayWindow(time(9, 12));
		const divisions = ticks(bounds, 320, 'minute');
		expect(divisions.length).toBeGreaterThanOrEqual(24);
		expect(divisions.filter((t) => t.label).length).toBeLessThan(divisions.length / 2);
		expect(divisions.some((t) => t.value === time(9, 1) && !t.label)).toBe(true);
	});
	it('uses calendar boundaries, including a DST transition day', () => {
		const value = new Date(2026, 2, 29, 12).getTime();
		const bounds = dayWindow(value);
		expect(new Date(bounds.start).getHours()).toBe(0);
		expect(new Date(bounds.start).getDate()).toBe(29);
		expect(new Date(bounds.end).getHours()).toBe(0);
		expect(new Date(bounds.end).getDate()).toBe(30);
	});
});
