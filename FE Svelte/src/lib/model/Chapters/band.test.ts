import { describe, expect, it } from 'vitest';
import { bandSegments, fitLabel, freeHue } from './band';
import { chapters, now } from './Chapters.fixture';
import { ms } from './time';

describe('the band', () => {
	const window = { start: ms('2026-09-10T00:00:00+02:00'), end: ms('2026-10-10T00:00:00+02:00') };
	it('pins the name of a chapter that started off screen and leaves out the ones outside', () => {
		const segments = bandSegments(chapters, window, 1000, now);
		expect(segments.map((item) => item.id)).toEqual(['system', 'out']);
		const [current, next] = segments;
		expect(current.x0).toBeLessThan(0);
		expect(current.labelX).toBe(6);
		expect(current.status).toBe('current');
		expect(current.stages.map((item) => [item.id, item.current])).toEqual([['push', true]]);
		expect(next.open).toBe(true);
		expect(next.x1).toBeGreaterThan(1000);
		expect(next.status).toBe('future');
	});
	it('fits a band label: the dates only beside the whole name', () => {
		expect(fitLabel(200, 100, 60)).toEqual({ name: true, extra: true });
		expect(fitLabel(120, 100, 60)).toEqual({ name: true, extra: false });
		expect(fitLabel(40, 100, 60)).toEqual({ name: true, extra: false });
		expect(fitLabel(20, 100, 60)).toEqual({ name: false, extra: false });
	});
	it('picks a hue far from every hue in use', () => {
		const used = [215, 195, 285, 285, 310, 30, 20, 350, 120, 5, 45, 170];
		expect(freeHue(used)).toBe(80);
		expect(freeHue([...used, 80])).toBe(250);
		expect(freeHue([])).toBe(0);
	});
});
