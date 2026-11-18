import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import type { WhenView } from '../WhenModel/types';
import {
	activeWhenQuickPick,
	dayKeyInZone,
	whenChoiceForDay,
	whenChoiceForQuickPick
} from './selection';

describe('WhenPopover selection mapping', () => {
	it('maps quick picks and calendar days to the public WhenChoice contract', () => {
		expect(whenChoiceForQuickPick('today')).toEqual({ kind: 'today' });
		expect(whenChoiceForQuickPick('tomorrow')).toEqual({ kind: 'tomorrow' });
		expect(whenChoiceForQuickPick('week')).toEqual({ kind: 'week' });
		expect(whenChoiceForQuickPick('undated')).toEqual({ kind: 'undated' });
		expect(whenChoiceForDay(new Date(2026, 10, 18, 12))).toEqual({
			kind: 'day',
			dayKey: '2026-11-18'
		});
	});

	it('uses now and the supplied zone for today, tomorrow, and week highlighting', () => {
		const now = Date.parse('2026-01-01T02:00:00Z');
		const todayKey = dayKeyInZone(now, 'America/Los_Angeles');
		expect(todayKey).toBe('2025-12-31');
		const dayView: WhenView = {
			placement: 'day',
			weekStart: null,
			dayKey: '2026-01-01',
			time: null,
			canSetTime: true,
			canClearTime: false,
			isExact: true
		};
		expect(activeWhenQuickPick(dayView, todayKey, now, 'America/Los_Angeles')).toBe('tomorrow');
		const weekView: WhenView = { ...dayView, placement: 'week', weekStart: '2025-12-29' };
		const weekStart = Temporal.ZonedDateTime.from(
			'2025-12-29T00:00-08:00[America/Los_Angeles]'
		).epochMilliseconds;
		expect(activeWhenQuickPick(weekView, todayKey, weekStart, 'America/Los_Angeles')).toBe('week');
		expect(activeWhenQuickPick(weekView, todayKey, now, 'America/Los_Angeles')).toBeNull();
	});
});
