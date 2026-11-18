import { describe, expect, it } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { backlogWithClosedChildren, boundsOf, weekBuckets, weekStartAt } from './WeekModel';
import { buildHierarchy } from '../Hierarchy/Hierarchy';

const zone = 'Europe/Belgrade';
const now = Date.parse('2026-09-16T10:00:00Z');
const weekStart = Date.parse('2026-09-13T22:00:00Z');
const trace = (
	id: string,
	time: ExplorerTrace['aboutTime'],
	patch: Partial<ExplorerTrace> = {}
): ExplorerTrace => ({
	id,
	content: id,
	relation: 'intend',
	timezone: zone,
	aboutKind: 'instant',
	aboutTime: time,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin: { kind: 'canonical', sourceId: 'test' },
	...patch
});
const day = (start: string): ExplorerTrace['aboutTime'] => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end: null
});
const minute = (start: string): ExplorerTrace['aboutTime'] => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start,
	end: null
});
const minuteInterval = (start: string, end: string): ExplorerTrace['aboutTime'] => ({
	basis: 'absolute',
	precision: 'minute',
	certainty: 'exact',
	start,
	end
});
const ids = (items: ExplorerTrace[]) => items.map((item) => item.id);

describe('weekBuckets', () => {
	it('assigns each intention once, orders items, and ignores facts', () => {
		const traces = [
			trace('today-b', day('2026-09-16')),
			trace('today-a', day('2026-09-16')),
			trace('yesterday-open', day('2026-09-15')),
			trace('yesterday-closed', day('2026-09-15'), { intentOpen: false }),
			trace('month', {
				basis: 'absolute',
				precision: 'month',
				certainty: 'exact',
				start: '2026-09',
				end: null
			}),
			trace('unknown', { basis: 'unknown' }),
			trace('unknown-closed', { basis: 'unknown' }, { intentOpen: false }),
			trace('relative', {
				basis: 'relative',
				precision: 'day',
				anchorTraceId: 'anchor',
				relation: 'after'
			}),
			trace('future', day('2026-09-21')),
			trace('fact', day('2026-09-16'), { relation: 'actual' }),
			trace('last-sunday', minute('2026-09-20T23:59:00+02:00')),
			trace('next-monday', minute('2026-09-21T00:00:00+02:00'))
		];
		const result = weekBuckets(traces, now, now, zone);
		expect(result.weekStart).toBe(weekStart);
		expect(ids(result.days[1].items)).toEqual(['yesterday-closed']);
		expect(ids(result.days[2].items)).toEqual(['today-a', 'today-b']);
		expect(ids(result.days[6].items)).toEqual(['last-sunday']);
		expect(ids(result.week)).toEqual(['month']);
		expect(ids(result.undated)).toEqual(['relative', 'unknown']);
		expect(ids(result.review)).toEqual(['yesterday-open']);
		expect(ids(result.later)).toEqual(['future', 'next-monday']);
		expect(result.outside).toBe(1);
		const listed = [
			...result.days.flatMap((d) => d.items),
			...result.week,
			...result.undated,
			...result.review,
			...result.later
		];
		expect(new Set(ids(listed)).size).toBe(listed.length);
		expect(listed.length + result.outside).toBe(traces.length - 1);
	});
	it('buckets every intent outcome by open state for a past day without losing any trace', () => {
		const outcomes = ['completed', 'partial', 'alternative', 'not_completed', null] as const;
		const traces = outcomes.flatMap((intentOutcome) =>
			[true, false].map((intentOpen) =>
				trace(
					`${intentOutcome ?? 'none'}-${intentOpen ? 'open' : 'closed'}`,
					minuteInterval('2026-09-15T10:00:00+02:00', '2026-09-15T11:00:00+02:00'),
					{ aboutKind: 'interval', intentOpen, intentOutcome }
				)
			)
		);
		const result = weekBuckets(traces, now, now, zone);
		const openIds = outcomes.map((outcome) => `${outcome ?? 'none'}-open`).sort();
		const closedIds = outcomes.map((outcome) => `${outcome ?? 'none'}-closed`).sort();
		const assigned = [
			...result.days.flatMap((bucket) => ids(bucket.items)),
			...ids(result.week),
			...ids(result.undated),
			...ids(result.review),
			...ids(result.later)
		];

		expect(ids(result.review)).toEqual(openIds);
		expect(ids(result.days[1].items)).toEqual(closedIds);
		expect(
			result.days
				.filter((bucket) => bucket.dayKey !== '2026-09-15')
				.every((bucket) => bucket.items.length === 0)
		).toBe(true);
		expect(result.week).toEqual([]);
		expect(result.undated).toEqual([]);
		expect(result.later).toEqual([]);
		expect(result.outside).toBe(0);
		expect(assigned).toHaveLength(traces.length);
		expect(new Set(assigned)).toEqual(new Set(traces.map((item) => item.id)));
	});
	it('places a past open intention in review at Belgrade midnight and in later just after', () => {
		const midnight = Date.parse('2026-09-16T00:00:00+02:00');
		const atMidnight = trace(
			'end-at-midnight',
			minuteInterval('2026-09-15T23:59:00+02:00', '2026-09-16T00:00:00+02:00'),
			{ aboutKind: 'interval', intentOpen: true }
		);
		const afterMidnight = trace(
			'end-one-ms-after',
			minuteInterval('2026-09-15T23:59:00+02:00', '2026-09-16T00:00:00.001+02:00'),
			{ aboutKind: 'interval', intentOpen: true }
		);
		const boundaryNow = midnight;
		const result = weekBuckets([atMidnight, afterMidnight], boundaryNow, boundaryNow, zone);

		expect(boundsOf(atMidnight, boundaryNow, zone)?.end).toBe(midnight);
		expect(boundsOf(afterMidnight, boundaryNow, zone)?.end).toBe(midnight + 1);
		expect(ids(result.review)).toEqual(['end-at-midnight']);
		expect(ids(result.week)).toEqual([]);
		expect(ids(result.later)).toEqual(['end-one-ms-after']);
		expect(result.days.every((bucket) => bucket.items.length === 0)).toBe(true);
		expect(result.undated).toEqual([]);
		expect(result.outside).toBe(0);
	});
	it('places open dated items outside the displayed week in later, except review', () => {
		const traces = [
			trace('today-b', day('2026-09-16')),
			trace('today-a', day('2026-09-16')),
			trace('past', day('2026-09-15')),
			trace('next', day('2026-09-21')),
			trace('after', day('2026-09-28')),
			trace('closed', day('2026-09-28'), { intentOpen: false }),
			trace('closed-undated', null, { intentOpen: false })
		];
		const result = weekBuckets(traces, Date.parse('2026-09-21T12:00:00Z'), now, zone);
		expect(ids(result.later)).toEqual(['today-a', 'today-b', 'after']);
		expect(ids(result.review)).toEqual(['past']);
		expect(ids(result.days[0].items)).toEqual(['next']);
		expect(result.outside).toBe(2);
		const listed = [
			...result.days.flatMap((day) => day.items),
			...result.week,
			...result.undated,
			...result.review,
			...result.later
		];
		expect(new Set(ids(listed)).size).toBe(listed.length);
		expect(listed.length + result.outside).toBe(traces.length);
	});
	it('uses local calendar boundaries on daylight-saving transitions and keeps ongoing intervals out of review', () => {
		const anchor = Date.parse('2026-03-29T12:00:00Z');
		expect(weekStartAt(anchor, zone)).toBe(Date.parse('2026-03-22T23:00:00Z'));
		const open = trace('ongoing', day('2026-03-23'), { aboutKind: 'interval' });
		const result = weekBuckets([open], anchor, anchor, zone);
		expect(ids(result.week)).toEqual(['ongoing']);
		expect(result.review).toEqual([]);
	});
	it('keeps a duration with an uncertain start out of review until its latest possible end', () => {
		const planned = trace(
			'window',
			{
				basis: 'absolute',
				precision: 'day',
				certainty: 'approximate',
				start: '2026-09-01',
				end: '2026-09-10'
			},
			{ aboutKind: 'interval', statedDuration: { amount: 4, unit: 'day' } }
		);
		const onThirteenth = Date.parse('2026-09-13T10:00:00Z');
		expect(weekBuckets([planned], onThirteenth, onThirteenth, zone).review).toEqual([]);
		const onFourteenth = Date.parse('2026-09-14T10:00:00Z');
		expect(ids(weekBuckets([planned], onFourteenth, onFourteenth, zone).review)).toEqual([
			'window'
		]);
	});
	it('uses stated duration to locate longer periods and orders by actual start', () => {
		const later = trace('a', minute('2026-09-16T15:00:00+02:00'));
		const earlier = trace('z', minute('2026-09-16T09:00:00+02:00'));
		const long = trace('long', day('2026-09-16'), {
			aboutKind: 'interval',
			statedDuration: { amount: 2, unit: 'day' }
		});
		const result = weekBuckets([later, long, earlier], now, now, zone);
		expect(ids(result.days[2].items)).toEqual(['z', 'a']);
		expect(ids(result.week)).toEqual(['long']);
	});
});

describe('backlogWithClosedChildren', () => {
	it('retains closed children under an open shelf parent but excludes closed orphans', () => {
		const parent = trace('parent', null);
		const child = trace('child', null, { intentOpen: false });
		const orphan = trace('orphan', null, { intentOpen: false });
		const traces = [parent, child, orphan];
		const links = [
			{
				id: 'link',
				fromId: 'child',
				toId: 'parent',
				kind: 'part_of' as const,
				context: null,
				origin: parent.origin
			}
		];
		const buckets = weekBuckets(traces, now, now, zone);
		expect(
			ids(backlogWithClosedChildren(buckets.undated, traces, buildHierarchy(traces, links)))
		).toEqual(['parent', 'child']);
		expect(buckets.outside).toBe(2);
	});
});
