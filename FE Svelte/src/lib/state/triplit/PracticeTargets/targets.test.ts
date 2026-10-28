import { describe, expect, it } from 'vitest';
import { currentWeek, mondayOf, parsePracticeTarget, weeklyTargetFor } from './targets';
import type { PracticeTarget } from './types';

const row = (over: Partial<PracticeTarget>): PracticeTarget => ({
	id: 'a',
	sourceId: 'source',
	scopeId: 'serbian',
	minutesPerWeek: 120,
	effectiveFromWeek: '2026-10-19',
	createdAt: '2026-10-19T08:00:00.000Z',
	isDeleted: false,
	...over
});

describe('weekly practice targets', () => {
	it('finds the local Monday, across month and year boundaries', () => {
		expect(mondayOf('2026-10-26')).toBe('2026-10-26');
		expect(mondayOf('2026-11-01')).toBe('2026-10-26');
		expect(mondayOf('2027-01-01')).toBe('2026-12-28');
	});
	it('takes the week of the wall clock in the given timezone', () => {
		// Sunday 23:30 in Belgrade is already Monday in UTC+9 and still Sunday in UTC.
		const late = new Date('2026-11-01T22:30:00Z');
		expect(currentWeek(late, 'Europe/Belgrade')).toBe('2026-10-26');
		expect(currentWeek(late, 'Asia/Tokyo')).toBe('2026-11-02');
		expect(currentWeek(new Date('2026-11-01T23:30:00Z'), 'Europe/Belgrade')).toBe('2026-11-02');
	});
	it('applies the latest statement made for the week or before it', () => {
		const rows = [
			row({ id: 'a' }),
			row({ id: 'b', minutesPerWeek: 180, effectiveFromWeek: '2026-10-26' }),
			row({
				id: 'c',
				minutesPerWeek: 200,
				effectiveFromWeek: '2026-10-26',
				createdAt: '2026-10-27T08:00:00.000Z'
			}),
			row({ id: 'd', scopeId: 'other', minutesPerWeek: 30 })
		];
		expect(weeklyTargetFor(rows, 'serbian', '2026-10-12')).toBeNull();
		expect(weeklyTargetFor(rows, 'serbian', '2026-10-25')).toBe(120);
		expect(weeklyTargetFor(rows, 'serbian', '2026-10-28')).toBe(200);
		expect(weeklyTargetFor(rows, 'serbian', '2026-12-30')).toBe(200);
	});
	it('reads a cleared or deleted statement as no goal from its week on', () => {
		const rows = [
			row({ id: 'a' }),
			row({ id: 'b', minutesPerWeek: null, effectiveFromWeek: '2026-10-26' }),
			row({ id: 'c', minutesPerWeek: 300, effectiveFromWeek: '2026-11-02', isDeleted: true })
		];
		expect(weeklyTargetFor(rows, 'serbian', '2026-10-20')).toBe(120);
		expect(weeklyTargetFor(rows, 'serbian', '2026-11-03')).toBeNull();
	});
	it('refuses malformed rows', () => {
		expect(parsePracticeTarget(row({}))).toEqual(row({}));
		for (const bad of [
			{ effectiveFromWeek: '2026-10-20' },
			{ minutesPerWeek: 0 },
			{ minutesPerWeek: 1.5 },
			{ minutesPerWeek: 7 * 24 * 60 + 1 },
			{ sourceId: 'other' },
			{ scopeId: '' }
		])
			expect(() => parsePracticeTarget({ ...row({}), ...bad })).toThrow();
	});
});
