import { describe, expect, it } from 'vitest';
import { DAY_MS, DEFAULT_LIMITS } from './constants';
import {
	clampWindow,
	fitWindow,
	followWindow,
	panWindow,
	pxAtTime,
	pxPerDay,
	spanWindow,
	timeAtPx,
	zoomWindow
} from './math';

const T0 = Date.UTC(2026, 0, 1);
const window = { start: T0, end: T0 + 100 * DAY_MS };

describe('clampWindow', () => {
	it('widens a window that is narrower than the minimum span around its centre', () => {
		const tiny = { start: T0, end: T0 + DAY_MS / 2 };
		const clamped = clampWindow(tiny, DEFAULT_LIMITS);
		expect(clamped.end - clamped.start).toBe(DEFAULT_LIMITS.minSpanMs);
		expect((clamped.start + clamped.end) / 2).toBe((tiny.start + tiny.end) / 2);
	});

	it('narrows a window wider than the maximum span', () => {
		const huge = { start: T0, end: T0 + 2 * DEFAULT_LIMITS.maxSpanMs };
		expect(clampWindow(huge, DEFAULT_LIMITS).end - clampWindow(huge, DEFAULT_LIMITS).start).toBe(
			DEFAULT_LIMITS.maxSpanMs
		);
	});

	it('slides the window back inside the bounds without changing its span', () => {
		const limits = { ...DEFAULT_LIMITS, minStart: T0, maxEnd: T0 + 365 * DAY_MS };
		const early = clampWindow({ start: T0 - 10 * DAY_MS, end: T0 + 90 * DAY_MS }, limits);
		expect(early).toEqual({ start: T0, end: T0 + 100 * DAY_MS });
		const late = clampWindow({ start: T0 + 300 * DAY_MS, end: T0 + 400 * DAY_MS }, limits);
		expect(late).toEqual({ start: T0 + 265 * DAY_MS, end: T0 + 365 * DAY_MS });
	});
});

describe('zoom and pan', () => {
	it('keeps the anchor at the same pixel while zooming', () => {
		const anchor = T0 + 25 * DAY_MS;
		const zoomed = zoomWindow(window, 0.5, anchor);
		expect(pxAtTime(zoomed, anchor, 1000)).toBeCloseTo(pxAtTime(window, anchor, 1000));
		expect(zoomed.end - zoomed.start).toBe(50 * DAY_MS);
	});

	it('pans by a time delta', () => {
		expect(panWindow(window, 3 * DAY_MS)).toEqual({
			start: T0 + 3 * DAY_MS,
			end: T0 + 103 * DAY_MS
		});
	});

	it('places the centre of a preset span at the past ratio', () => {
		const w = spanWindow(T0, 10 * DAY_MS, 0.7);
		expect(w).toEqual({ start: T0 - 7 * DAY_MS, end: T0 + 3 * DAY_MS });
	});

	it('fits a range with padding but never less than a day', () => {
		expect(fitWindow(T0, T0 + DAY_MS, 0.08)).toEqual({ start: T0 - DAY_MS, end: T0 + 2 * DAY_MS });
		const wide = fitWindow(T0, T0 + 100 * DAY_MS, 0.1);
		expect(wide).toEqual({ start: T0 - 10 * DAY_MS, end: T0 + 110 * DAY_MS });
	});

	it('keeps «сейчас» at the follow ratio', () => {
		const w = followWindow(T0, 100 * DAY_MS, 0.75);
		expect(pxAtTime(w, T0, 1000)).toBeCloseTo(750);
	});
});

describe('pixel conversions', () => {
	it('round-trips between time and pixels', () => {
		const t = timeAtPx(window, 250, 1000);
		expect(t).toBe(T0 + 25 * DAY_MS);
		expect(pxAtTime(window, t, 1000)).toBe(250);
		expect(pxPerDay(window, 1000)).toBe(10);
	});
});
