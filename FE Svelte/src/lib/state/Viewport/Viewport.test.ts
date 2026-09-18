import { describe, expect, it } from 'vitest';
import { DAY_MS, FOLLOW_NOW_RATIO, ZOOM_STEP } from './constants';
import { pxAtTime } from './math';
import { ViewportState } from './Viewport.svelte';

const NOW = Date.UTC(2026, 8, 4, 10);
const initial = { start: NOW - 200 * DAY_MS, end: NOW + 40 * DAY_MS };
const make = (): ViewportState => new ViewportState(initial, { now: () => NOW });

describe('ViewportState', () => {
	it('fits an entire multi-year Scope and then closes in on a point record', () => {
		const viewport = make();
		const start = Date.UTC(2000, 0, 1);
		const end = Date.UTC(2026, 0, 1);
		viewport.fit(start, end);
		expect(viewport.window.start).toBeLessThan(start);
		expect(viewport.window.end).toBeGreaterThan(end);
		viewport.fit(NOW, NOW);
		expect(viewport.spanDays).toBe(2);
		expect((viewport.window.start + viewport.window.end) / 2).toBe(NOW);
	});

	it('starts from the clamped initial window', () => {
		const viewport = make();
		expect(viewport.window).toEqual(initial);
		expect(viewport.spanDays).toBe(240);
	});

	it('zooms in around the given anchor and out again', () => {
		const viewport = make();
		const anchor = NOW - 100 * DAY_MS;
		viewport.zoomIn(anchor);
		expect(viewport.spanDays).toBeCloseTo(240 * ZOOM_STEP);
		expect(pxAtTime(viewport.window, anchor, 1000)).toBeCloseTo(pxAtTime(initial, anchor, 1000));
		viewport.zoomOut(anchor);
		expect(viewport.spanDays).toBeCloseTo(240);
	});

	it('pans and stops following', () => {
		const viewport = make();
		viewport.startFollow();
		expect(viewport.follow).toBe(true);
		viewport.panStep(1);
		expect(viewport.follow).toBe(false);
		expect(viewport.window.start).toBeGreaterThan(initial.start);
	});

	it('keeps «сейчас» at the follow ratio on every tick', () => {
		const viewport = make();
		viewport.startFollow();
		expect(pxAtTime(viewport.window, NOW, 1000)).toBeCloseTo(1000 * FOLLOW_NOW_RATIO);
		viewport.tick(NOW + 3 * DAY_MS);
		expect(pxAtTime(viewport.window, NOW + 3 * DAY_MS, 1000)).toBeCloseTo(1000 * FOLLOW_NOW_RATIO);
		expect(viewport.spanDays).toBeCloseTo(240);
	});

	it('anchors zoom on «сейчас» while following', () => {
		const viewport = make();
		viewport.startFollow();
		viewport.zoomIn(NOW - 100 * DAY_MS);
		expect(pxAtTime(viewport.window, NOW, 1000)).toBeCloseTo(1000 * FOLLOW_NOW_RATIO);
	});

	it('applies presets around the centre, never past «сейчас»', () => {
		const viewport = make();
		viewport.setSpanDays(30);
		expect(viewport.spanDays).toBeCloseTo(30);
		expect(viewport.window.end).toBeLessThanOrEqual(NOW + 30 * DAY_MS);
		viewport.fit(NOW - 10 * DAY_MS, NOW);
		expect(viewport.window.start).toBeLessThan(NOW - 10 * DAY_MS);
		expect(viewport.window.end).toBeGreaterThan(NOW);
	});

	it.each([216, 240])('keeps the scale when revealing an interval of %i days', (days) => {
		const viewport = make();
		const duration = days * DAY_MS;
		const inside = initial.start + (viewport.spanMs - duration) / 2;
		viewport.reveal(inside, inside + duration);
		expect(viewport.window).toEqual(initial);

		viewport.startFollow();
		const far = NOW - 600 * DAY_MS;
		viewport.reveal(far, far + duration);
		expect(viewport.follow).toBe(false);
		expect(viewport.spanDays).toBe(240);
		expect((viewport.window.start + viewport.window.end) / 2).toBe(far + duration / 2);
	});

	it('reveals a range keeping the scale and fits one longer than the window', () => {
		const viewport = make();
		viewport.startFollow();
		const followed = viewport.window;
		viewport.reveal(NOW - 100 * DAY_MS, NOW - 100 * DAY_MS);
		expect(viewport.follow).toBe(true);
		expect(viewport.window).toEqual(followed);
		const far = NOW - 400 * DAY_MS;
		viewport.reveal(far, far);
		expect(viewport.follow).toBe(false);
		expect(viewport.spanDays).toBeCloseTo(240);
		expect((viewport.window.start + viewport.window.end) / 2).toBeCloseTo(far);
		viewport.reveal(NOW - 1000 * DAY_MS, NOW);
		expect(viewport.window.start).toBeCloseTo(NOW - 1100 * DAY_MS);
		expect(viewport.window.end).toBeCloseTo(NOW + 100 * DAY_MS);
		const before = viewport.window;
		viewport.reveal(NOW - 300 * DAY_MS, NOW - 300 * DAY_MS, true);
		expect(viewport.window).not.toEqual(before);
		expect((viewport.window.start + viewport.window.end) / 2).toBeCloseTo(NOW - 300 * DAY_MS);
	});
});
