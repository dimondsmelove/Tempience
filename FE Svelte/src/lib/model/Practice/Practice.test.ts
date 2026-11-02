import { describe, expect, it } from 'vitest';
import {
	activityBuckets,
	adjacentPeriod,
	entriesIn,
	periodRange,
	remainingMinutes,
	sortDirections,
	totalMinutes,
	weekHistory
} from './model';
import type { PracticeEntry } from './types';

const kindId = 'practice-kind';
const activityIds = ['writing', 'reading'];
const entries: readonly PracticeEntry[] = [
	{
		id: 'a',
		kindId,
		scopeIds: ['practice', 'writing'],
		date: '2026-10-26',
		hour: 9,
		data: { minutes: 60 },
		note: ''
	},
	{
		id: 'b',
		kindId,
		scopeIds: ['practice', 'reading'],
		date: '2026-10-31',
		hour: null,
		data: { minutes: 30 },
		note: ''
	},
	{
		id: 'c',
		kindId,
		scopeIds: ['practice', 'writing'],
		date: '2026-11-02',
		hour: 10,
		data: { minutes: 999 },
		note: ''
	}
];

describe('practice statistics', () => {
	it('uses Monday weeks across a month boundary and excludes the following Monday', () => {
		const range = periodRange('week', '2026-10-28');
		expect(range).toEqual({ start: '2026-10-26', end: '2026-11-02' });
		expect(totalMinutes(entriesIn(entries, range, null, kindId))).toBe(90);
	});

	it('filters by kind and selected activity', () => {
		const range = periodRange('week', '2026-10-28');
		const otherKind = { ...entries[0], kindId: 'other' };
		expect(totalMinutes(entriesIn([...entries, otherKind], range, 'reading', kindId))).toBe(30);
	});

	it('keeps period buckets, activity slices and history totals consistent', () => {
		for (const period of ['day', 'week', 'month'] as const) {
			const range = periodRange(period, '2026-10-28');
			const selected = entriesIn(entries, range, null, kindId);
			expect(
				activityBuckets(selected, period, range, activityIds).reduce(
					(sum, bucket) => sum + bucket.minutes,
					0
				)
			).toBe(totalMinutes(selected));
		}
		const range = periodRange('week', '2026-10-28');
		const filtered = activityBuckets(
			entriesIn(entries, range, 'reading', kindId),
			'week',
			range,
			activityIds
		);
		expect(
			filtered
				.flatMap((bucket) => bucket.slices)
				.filter((slice) => slice.activityId !== 'reading')
				.every((slice) => slice.minutes === 0 && slice.sessions === 0)
		).toBe(true);
		const current = weekHistory(entries, '2026-10-28', null, { kindId, activityIds });
		expect(current[4]?.minutes).toBe(90);
		for (const bucket of current) {
			expect(bucket.slices.reduce((sum, slice) => sum + slice.minutes, 0)).toBe(bucket.minutes);
			expect(bucket.slices.reduce((sum, slice) => sum + slice.sessions, 0)).toBe(bucket.sessions);
		}
	});

	it('navigates calendar periods without skipping February', () => {
		expect(adjacentPeriod('month', '2026-01-31', 1)).toBe('2026-02-01');
		expect(adjacentPeriod('month', '2026-03-31', -1)).toBe('2026-02-28');
		expect(periodRange('month', '2028-02-29')).toEqual({ start: '2028-02-01', end: '2028-03-01' });
	});

	it('clamps remaining minutes per activity and preserves exact ratio sorting', () => {
		expect(remainingMinutes(125, 100)).toBe(0);
		const rows = [
			{ id: 'large', minutes: 400, weeklyMinutes: 1000 },
			{ id: 'small', minutes: 41, weeklyMinutes: 100 },
			{ id: 'over', minutes: 120, weeklyMinutes: 100 },
			{ id: 'none', minutes: 200, weeklyMinutes: null }
		];
		expect(sortDirections(rows, 'week', 'descending').map((row) => row.id)).toEqual([
			'over',
			'small',
			'large',
			'none'
		]);
		expect(sortDirections(rows, 'month', 'descending').map((row) => row.id)).toEqual([
			'large',
			'none',
			'over',
			'small'
		]);
		expect(rows.map((row) => row.id)).toEqual(['large', 'small', 'over', 'none']);
	});
});
