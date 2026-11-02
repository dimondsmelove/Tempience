import { describe, expect, it } from 'vitest';
import { periodRange, sortDirections } from '../../model/Practice/model';
import type { PracticeChartActivity, PracticeEntry } from '../../model/Practice/types';
import {
	historyActivityIds,
	liveDirections,
	rangeActivityIds,
	plannedMinutes,
	liveHistory,
	selectionGoal,
	selectionRemaining,
	type GoalOf
} from './live';

const activity = (id: string): PracticeChartActivity => ({
	id,
	name: id,
	note: '',
	weeklyMinutes: null,
	colour: null,
	color: null
});
const entry = (id: string, scope: string, date: string, minutes: number): PracticeEntry => ({
	id,
	kindId: 'k',
	scopeIds: [scope],
	date,
	hour: null,
	data: { minutes },
	note: ''
});
// a: 60 until the week of 2026-10-26, then 120; b: 30 from that week, none before.
const goalOf: GoalOf = (id, date) =>
	id === 'a' ? (date >= '2026-10-26' ? 120 : 60) : date >= '2026-10-26' ? 30 : null;
const entries = [
	entry('1', 'a', '2026-10-27', 150),
	entry('2', 'b', '2026-10-28', 10),
	entry('3', 'a', '2026-10-20', 30)
];

describe('live practice directions', () => {
	it('measures each activity against its own goal and clamps remaining per activity', () => {
		const rows = liveDirections(
			[activity('a'), activity('b')],
			entries,
			'k',
			'week',
			periodRange('week', '2026-10-28'),
			goalOf
		);
		expect(rows.map((row) => [row.minutes, row.weeklyMinutes, row.percent, row.remaining])).toEqual(
			[
				[150, 120, 125, 0],
				[10, 30, 33, 20]
			]
		);
		// The surplus of a does not cover the shortfall of b.
		expect(selectionRemaining(rows)).toBe(20);
		expect(selectionGoal(['a', 'b'], '2026-10-26', goalOf)).toBe(150);
	});
	it('shows no goal off the week, or where an activity has none', () => {
		const past = liveDirections(
			[activity('a'), activity('b')],
			entries,
			'k',
			'week',
			periodRange('week', '2026-10-20'),
			goalOf
		);
		expect(past.map((row) => row.weeklyMinutes)).toEqual([60, null]);
		expect(selectionRemaining(past)).toBeNull();
		expect(selectionGoal(['a', 'b'], '2026-10-19', goalOf)).toBeNull();
		const month = liveDirections(
			[activity('a')],
			entries,
			'k',
			'month',
			periodRange('month', '2026-10-28'),
			goalOf
		);
		expect(month[0].weeklyMinutes).toBeNull();
	});
	it('excludes unplanned facts from aggregate completion while preserving individual over-goal progress', () => {
		const range = periodRange('week', '2026-10-28');
		const all = [...entries, entry('4', 'outside', '2026-10-28', 30)];
		const plannedOf = (id: string, date: string): boolean =>
			id !== 'outside' && date >= '2026-10-26';
		const rows = liveDirections(
			[activity('a'), activity('outside')],
			all,
			'k',
			'week',
			range,
			goalOf,
			plannedOf
		);
		expect(rows[0]).toMatchObject({ minutes: 150, percent: 125, unplannedMinutes: 0 });
		expect(rows[1]).toMatchObject({ minutes: 30, unplannedMinutes: 30 });
		expect(plannedMinutes(all, range, null, 'k', plannedOf)).toBe(160);
	});
	it('keeps range choices independent of the selected activity and scopes history to its own weeks', () => {
		const range = periodRange('week', '2026-10-28');
		const rangeIds = rangeActivityIds(
			[entry('a-now', 'a', '2026-10-27', 10), entry('b-now', 'b', '2026-10-28', 20)],
			range,
			'k',
			['planned']
		);
		expect(rangeIds).toEqual(['planned', 'a', 'b']);

		const historyIds = historyActivityIds(
			[
				entry('old-a', 'a', '2026-10-07', 10),
				entry('old-b', 'b', '2026-10-20', 20),
				{ ...entry('other-kind', 'c', '2026-10-27', 5), kindId: 'other' }
			],
			'2026-10-28',
			'k',
			['a', 'b', 'c', 'planned', 'empty'],
			(week) => (week === '2026-10-12' ? ['planned'] : [])
		);
		expect(historyIds).toEqual(['a', 'b', 'planned']);
	});

	it('keeps the historic goal of every week', () => {
		const history = liveHistory(entries, '2026-10-28', 'a', 'k', ['a', 'b'], goalOf);
		expect(history.at(4)).toMatchObject({ date: '2026-10-26', minutes: 150, goal: 120 });
		expect(history.at(3)).toMatchObject({ date: '2026-10-19', minutes: 30, goal: 60 });
	});
	it('sorts by completion with real goals and puts activities without one after them', () => {
		const rows = [
			{ id: 'none', minutes: 500, weeklyMinutes: null },
			{ id: 'half', minutes: 30, weeklyMinutes: 60 },
			{ id: 'full', minutes: 90, weeklyMinutes: 60 }
		];
		expect(sortDirections(rows, 'week', 'descending').map((row) => row.id)).toEqual([
			'full',
			'half',
			'none'
		]);
		expect(sortDirections(rows, 'week', 'ascending').map((row) => row.id)).toEqual([
			'half',
			'full',
			'none'
		]);
		expect(sortDirections(rows, 'month', 'descending').map((row) => row.id)).toEqual([
			'none',
			'full',
			'half'
		]);
	});
});
