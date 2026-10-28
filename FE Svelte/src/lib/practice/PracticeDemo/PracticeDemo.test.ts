import { describe, expect, it } from 'vitest';
import { DEMO_ACTIVITIES, DEMO_TODAY } from './constants';
import { demoEntries } from './fixture';
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

describe('practice demo statistics', () => {
	const entries = demoEntries();

	it('uses Monday weeks across a month boundary and excludes the following Monday', () => {
		const range = periodRange('week', DEMO_TODAY);
		expect(range).toEqual({ start: '2026-10-26', end: '2026-11-02' });
		const boundary = { ...entries[0], date: range.end, data: { minutes: 999 } };
		expect(totalMinutes(entriesIn([...entries, boundary], range))).toBe(930);
	});

	it('counts only the configured Kind and selected activity, including its base Scope', () => {
		const range = periodRange('week', DEMO_TODAY);
		const otherKind = { ...entries[0], kindId: 'unrelated', date: DEMO_TODAY };
		expect(totalMinutes(entriesIn([...entries, otherKind], range, 'serbian'))).toBe(75);
	});

	it('keeps day, month, activity and history totals consistent with the same records', () => {
		for (const period of ['day', 'week', 'month'] as const) {
			const range = periodRange(period, DEMO_TODAY);
			const selected = entriesIn(entries, range);
			expect(
				activityBuckets(selected, period, range).reduce((sum, bucket) => sum + bucket.minutes, 0)
			).toBe(totalMinutes(selected));
			expect(
				DEMO_ACTIVITIES.reduce(
					(sum, activity) => sum + totalMinutes(entriesIn(entries, range, activity.id)),
					0
				)
			).toBe(totalMinutes(selected));
		}
		expect(weekHistory(entries, DEMO_TODAY, null).at(-1)?.minutes).toBe(930);
	});

	it('navigates by calendar periods without skipping February', () => {
		expect(adjacentPeriod('month', '2026-01-31', 1)).toBe('2026-02-01');
		expect(adjacentPeriod('month', '2026-03-31', -1)).toBe('2026-02-28');
		expect(periodRange('month', '2028-02-29')).toEqual({ start: '2028-02-01', end: '2028-03-01' });
	});

	it('does not let surplus in one activity pay for another activity’s goal', () => {
		const range = periodRange('week', DEMO_TODAY);
		const remaining = DEMO_ACTIVITIES.reduce(
			(sum, activity) =>
				sum +
				remainingMinutes(
					totalMinutes(entriesIn(entries, range, activity.id)),
					activity.weeklyMinutes
				),
			0
		);
		expect(remaining).toBe(585);
	});
	it('preserves the minutes and session counts in every chart activity layer', () => {
		const range = periodRange('week', DEMO_TODAY);
		const selected = entriesIn(entries, range);
		const buckets = [
			...activityBuckets(selected, 'week', range),
			...weekHistory(entries, DEMO_TODAY, null)
		];
		for (const bucket of buckets) {
			expect(bucket.slices.reduce((sum, slice) => sum + slice.minutes, 0)).toBe(bucket.minutes);
			expect(bucket.slices.reduce((sum, slice) => sum + slice.sessions, 0)).toBe(bucket.sessions);
		}
		const filtered = activityBuckets(entriesIn(entries, range, 'serbian'), 'week', range);
		expect(
			filtered
				.flatMap((bucket) => bucket.slices)
				.filter((slice) => slice.activityId !== 'serbian')
				.every((slice) => slice.minutes === 0 && slice.sessions === 0)
		).toBe(true);
	});

	it('sorts weekly completion by the exact ratio, preserves over-completion and does not mutate rows', () => {
		const rows = [
			{ id: 'large', minutes: 400, weeklyMinutes: 1000 },
			{ id: 'small', minutes: 41, weeklyMinutes: 100 },
			{ id: 'over', minutes: 120, weeklyMinutes: 100 },
			{ id: 'empty', minutes: 0, weeklyMinutes: 100 }
		];
		expect(sortDirections(rows, 'week', 'descending').map((row) => row.id)).toEqual([
			'over',
			'small',
			'large',
			'empty'
		]);
		expect(sortDirections(rows, 'week', 'ascending').map((row) => row.id)).toEqual([
			'empty',
			'large',
			'small',
			'over'
		]);
		expect(sortDirections(rows, 'month', 'descending').map((row) => row.id)).toEqual([
			'large',
			'over',
			'small',
			'empty'
		]);
		expect(rows.map((row) => row.id)).toEqual(['large', 'small', 'over', 'empty']);
	});
});
