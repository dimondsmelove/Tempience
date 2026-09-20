import { describe, expect, it } from 'vitest';
import { closingGeometry } from './ClosingMark';

/** A 3 px capsule at 100–103 in a 16 px track at 18–34 on a 1000 px canvas. */
const extent = { x: 100, w: 3 };
const box = { y0: 18, y1: 34 };
const W = 1000;

describe('closingGeometry — the marker and the hairline of a closed intention (loop 008, C4)', () => {
	it('a later closing: the marker at its x, inset 3 px, the line from the right edge + 2 to the marker − 2', () => {
		const closing = closingGeometry(extent, box, 300, W);
		expect(closing.marker).toEqual({ x: 298, y: 21, w: 4, h: 10 });
		expect(closing.lineY).toBe(26.5);
		expect(closing.segments).toEqual([{ x0: 105, x1: 296 }]);
	});

	it('an earlier closing: the line runs left, from the marker + 2 to the left edge − 2', () => {
		const closing = closingGeometry(extent, box, 40, W);
		expect(closing.marker).toEqual({ x: 38, y: 21, w: 4, h: 10 });
		expect(closing.segments).toEqual([{ x0: 44, x1: 98 }]);
	});

	it('a closing within the mark’s own extent — an interval closed midway, the same day — draws the marker alone', () => {
		expect(closingGeometry({ x: 100, w: 60 }, box, 130, W).segments).toEqual([]);
		expect(closingGeometry(extent, box, 101.5, W).segments).toEqual([]);
		// Touching the edge is still outside: a gap of 2 leaves nothing to draw.
		expect(closingGeometry(extent, box, 105, W).segments).toEqual([]);
	});

	it('a closing past the canvas edge: the line to the edge, the marker where it is for the canvas to clip', () => {
		const later = closingGeometry(extent, box, 1400, W);
		expect(later.marker.x).toBe(1398);
		expect(later.segments).toEqual([{ x0: 105, x1: 1000 }]);
		const earlier = closingGeometry(extent, box, -30, W);
		expect(earlier.marker.x).toBe(-32);
		expect(earlier.segments).toEqual([{ x0: 0, x1: 98 }]);
	});

	it('the line is cut around every caption it would cross, with the plate’s room, and skips none above or below', () => {
		const captions = [
			{ x: 114, y: 20, width: 60, height: 12 },
			{ x: 200, y: 20, width: 20, height: 12 },
			// In another track: not crossed.
			{ x: 250, y: 40, width: 20, height: 12 }
		];
		expect(closingGeometry(extent, box, 300, W, captions).segments).toEqual([
			{ x0: 105, x1: 110 },
			{ x0: 178, x1: 196 },
			{ x0: 224, x1: 296 }
		]);
		// A caption reaching the marker leaves no last piece; one starting at the mark no first.
		expect(
			closingGeometry(extent, box, 300, W, [{ x: 100, y: 20, width: 200, height: 12 }]).segments
		).toEqual([]);
	});

	it('a short track keeps the marker at least 1 px high', () => {
		expect(closingGeometry(extent, { y0: 10, y1: 15 }, 300, W).marker).toMatchObject({
			y: 13,
			h: 1
		});
	});
});
