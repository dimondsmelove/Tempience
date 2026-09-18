import { describe, expect, it } from 'vitest';
import { TimeInputState } from './TimeInputState.svelte';
import { dayAt, durationLabel, rangeLabel } from './TimeInput';
import { matchesMinutes } from './duration';

const time = (day: number, hour: number, minute = 0) =>
	new Date(2026, 8, day, hour, minute).getTime();
const today = { start: time(9, 12), end: null, timed: false };

describe('independent duration in the common time draft', () => {
	it('keeps combined hours/minutes as one exact amount through apply, reopening and clock comparison', () => {
		const picker = new TimeInputState(today);
		picker.open();
		picker.setDetail('duration');
		picker.setDurationTime(2, 30);
		expect(picker.draft.duration).toEqual({ amount: 150, unit: 'minute' });
		expect(durationLabel(picker.draft)).toBe('2 ч 30 мин');
		expect(matchesMinutes(picker.draft.duration!, 150)).toBe(true);
		picker.apply();
		picker.open();
		expect(picker.durationUnit).toBe('hour');
		picker.setDetail('clock');
		picker.clock(9, 0);
		picker.beginEnd();
		picker.clock(11, 30);
		expect(picker.durationNotice).toBe('');
		picker.clock(11, 45);
		expect(picker.durationNotice).toBe('По границам — 2 ч 45 мин, ранее указано 2 ч 30 мин.');
		picker.setDetail('duration');
		expect(picker.draft.duration).toEqual({ amount: 165, unit: 'minute' });
		picker.setDurationTime(0, 30);
		expect(durationLabel(picker.draft)).toBe('30 мин');
		picker.setDurationTime(25, 10);
		expect(durationLabel(picker.draft)).toBe('25 ч 10 мин');
		picker.setDurationTime(0, 0);
		expect(picker.draft.duration).toBeUndefined();
	});
	it('keeps a day and quantity without inventing start/end, and applies only the chosen representation', () => {
		const picker = new TimeInputState(today);
		picker.open();
		picker.setDetail('duration');
		expect(picker.draft).toEqual(today);
		picker.setDuration(2, 'hour');
		picker.switchInput('timeline');
		picker.chooseDay(time(10, 0));
		expect(picker.draft).toEqual({
			...today,
			start: dayAt(time(10, 0)),
			duration: { amount: 2, unit: 'hour' }
		});
		picker.setDetail('clock');
		expect(picker.draft.timed).toBe(false);
		expect(picker.draft.end).toBe(null);
		picker.setDetail('duration');
		expect(picker.draft.duration).toEqual({ amount: 2, unit: 'hour' });
		picker.apply();
		expect(rangeLabel(picker.value)).toBe('10 сентября · 2 ч');
		picker.open();
		picker.setDuration(4);
		picker.cancel();
		expect(picker.draft).toEqual(picker.value);
	});
	it('remembers manual edits and clock boundaries while switching, and reports an explicit discrepancy', () => {
		const picker = new TimeInputState({ start: time(9, 9), end: time(9, 11), timed: true });
		picker.open();
		picker.setDetail('duration');
		expect(picker.draft.duration).toEqual({ amount: 2, unit: 'hour' });
		picker.setDuration(3);
		picker.chooseDay(time(10, 12));
		picker.setDetail('clock');
		expect(picker.draft).toEqual({ start: time(10, 9), end: time(10, 11), timed: true });
		expect(picker.durationNotice).toContain('ранее указано 3 ч');
		picker.setDetail('duration');
		expect(picker.draft.duration?.amount).toBe(3);
		picker.setDuration(2);
		picker.setDetail('clock');
		picker.focus('end');
		picker.clock(12, 0);
		expect(picker.durationNotice).toBe('По границам — 3 ч, ранее указано 2 ч.');
		picker.apply();
		expect(picker.value.duration).toBeUndefined();
		expect(durationLabel(picker.value)).toBe('3 ч');
	});
	it('preserves all measured minutes when clocks are removed and never invents elapsed hours from days', () => {
		const picker = new TimeInputState({ start: time(9, 9), end: time(9, 11, 37), timed: true });
		picker.open();
		picker.removeTime();
		expect(picker.detail).toBe('duration');
		expect(picker.draft).toEqual({ ...today, duration: { amount: 157, unit: 'minute' } });
		picker.setDuration(4, 'day');
		expect(durationLabel(picker.draft)).toBe('4 дн');
		expect(matchesMinutes(picker.draft.duration!, 4 * 24 * 60)).toBe(false);
		picker.setDuration(null);
		picker.apply();
		expect(picker.value).toEqual(today);
	});
	it('does not alter minutes while a two-digit end-hour command is incomplete', () => {
		const picker = new TimeInputState({ start: time(9, 9), end: null, timed: true });
		picker.open();
		picker.beginEnd();
		picker.clock(1, 0);
		expect(picker.draft.end).toBe(null);
		expect(picker.pickingEnd).toBe(true);
		picker.clock(12, 0);
		expect(picker.draft.end).toBe(time(9, 12));
	});
	it('restores pending end selection and cancels all uncommitted alternatives', () => {
		const picker = new TimeInputState(today);
		picker.open();
		picker.clock(9, 0);
		picker.beginEnd();
		picker.setDetail('duration');
		picker.setDuration(2);
		picker.setDetail('clock');
		expect(picker.pickingEnd).toBe(true);
		expect(picker.edge).toBe('end');
		expect(picker.draft.end).toBe(null);
		picker.cancel();
		picker.open();
		expect(picker.manualDuration).toBe(null);
		expect(picker.draft).toEqual(today);
	});
});
