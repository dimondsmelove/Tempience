import { describe, expect, it } from 'vitest';
import { DAY_MS, MAX_TRACKS } from './constants';
import {
	itemWidthPx,
	packTracks,
	trackCapacity,
	trackGeometry,
	trackHeightPx,
	visibleTracks
} from './Packing';
import type { PackItem } from './types';

const day = (n: number): number => Date.UTC(2026, 0, 1) + n * DAY_MS;
const point = (id: string, n: number): PackItem => ({
	id,
	start: day(n),
	end: null,
	kind: 'point'
});
const interval = (id: string, from: number, to: number): PackItem => ({
	id,
	start: day(from),
	end: day(to),
	kind: 'interval'
});

describe('itemWidthPx', () => {
	it('clamps points to the configured pixel range and keeps intervals to their length', () => {
		expect(itemWidthPx(point('a', 0), { pxPerDay: 0.5 })).toBe(2);
		expect(itemWidthPx(point('a', 0), { pxPerDay: 5 })).toBe(5);
		expect(itemWidthPx(point('a', 0), { pxPerDay: 40 })).toBe(8);
		expect(itemWidthPx(interval('b', 0, 10), { pxPerDay: 3 })).toBe(30);
		expect(itemWidthPx(interval('c', 0, 1), { pxPerDay: 0.1 })).toBe(2);
	});
});

describe('packTracks', () => {
	it('keeps non-overlapping items on one track', () => {
		const result = packTracks([point('a', 0), point('b', 10), point('c', 20)], { pxPerDay: 4 });
		expect([...result.trackOf.values()]).toEqual([0, 0, 0]);
		expect(result.tracks).toBe(1);
		expect(result.overlaps).toBe(0);
	});

	it('spreads colliding items over new tracks until the limit, then overlaps', () => {
		const items = Array.from({ length: 7 }, (_, i) => point(`p${i}`, 0));
		const result = packTracks(items, { pxPerDay: 4 });
		expect(result.tracks).toBe(MAX_TRACKS);
		expect(result.overlaps).toBe(2);
		expect(new Set(result.trackOf.values()).size).toBe(MAX_TRACKS);
	});

	it('is independent of where the visible window starts', () => {
		const items = [point('a', 0), point('b', 1), interval('c', 1, 6), point('d', 3), point('e', 9)];
		const shifted = items.map((item) => ({
			...item,
			start: item.start + 400 * DAY_MS,
			end: item.end === null ? null : item.end + 400 * DAY_MS
		}));
		const a = packTracks(items, { pxPerDay: 3 });
		const b = packTracks(shifted, { pxPerDay: 3 });
		expect([...a.trackOf.entries()]).toEqual([...b.trackOf.entries()]);
	});

	it('resolves collisions differently at different scales', () => {
		const items = [point('a', 0), point('b', 1)];
		expect(packTracks(items, { pxPerDay: 1 }).tracks).toBe(2);
		expect(packTracks(items, { pxPerDay: 30 }).tracks).toBe(1);
	});

	it('orders ties by id so the result is reproducible', () => {
		const a = packTracks([point('z', 0), point('a', 0)], { pxPerDay: 4 });
		const b = packTracks([point('a', 0), point('z', 0)], { pxPerDay: 4 });
		expect(a.trackOf.get('a')).toBe(0);
		expect(b.trackOf.get('a')).toBe(0);
	});
});

describe('track geometry', () => {
	it('shrinks track height as rows need more tracks', () => {
		expect(trackHeightPx(1)).toBe(16);
		expect(trackHeightPx(2)).toBe(11);
		expect(trackHeightPx(3)).toBe(7);
		expect(trackHeightPx(9)).toBe(7);
	});

	it('keeps the §4 table at 52 px and widens the pitch with the row, marks capped at 16', () => {
		expect(trackGeometry(52, 1)).toEqual({ pitchPx: 9, trackHeightPx: 16 });
		expect(trackGeometry(52, 2)).toEqual({ pitchPx: 9, trackHeightPx: 11 });
		expect(trackGeometry(52, 5)).toEqual({ pitchPx: 9, trackHeightPx: 7 });
		// usable = 80 − 6 − 2·2 = 70 → floor(70 / 5) = 14
		expect(trackGeometry(80, 1)).toEqual({ pitchPx: 14, trackHeightPx: 12 });
		expect(trackGeometry(80, 5)).toEqual({ pitchPx: 14, trackHeightPx: 12 });
		expect(trackGeometry(120, 3)).toEqual({ pitchPx: 20, trackHeightPx: 16 });
		expect(trackGeometry(200, 1).pitchPx).toBe(20);
	});

	it('uses tall rows for more than five tracks and accounts for the font', () => {
		expect(trackCapacity(600)).toBe(29);
		expect(trackCapacity(600, 30)).toBe(18);
		const items = Array.from({ length: 20 }, (_, i) => point(String(i), 0));
		expect(packTracks(items, { pxPerDay: 10, maxTracks: trackCapacity(600) }).overlaps).toBe(0);
	});

	it('counts only the tracks used by visible items', () => {
		const trackOf = new Map([
			['a', 0],
			['b', 3],
			['c', 1]
		]);
		expect(visibleTracks(trackOf, ['a', 'c'])).toBe(2);
		expect(visibleTracks(trackOf, ['b'])).toBe(4);
		expect(visibleTracks(trackOf, [])).toBe(1);
	});
});
