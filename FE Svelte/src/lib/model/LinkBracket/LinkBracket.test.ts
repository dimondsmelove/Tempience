import { describe, expect, it } from 'vitest';
import { linkBracket, nearestProjection } from './LinkBracket';
import type { BracketAnchor } from './types';

/** Rows of 52 px; a 16 px mark centred in each. */
const anchor = (x: number, rowIndex: number, y0 = rowIndex * 52 + 18): BracketAnchor => ({
	x,
	y0,
	y1: y0 + 16,
	rowIndex,
	rowCentreY: rowIndex * 52 + 26
});

describe('linkBracket: solid brackets on the 90° grid, not arcs', () => {
	it('same row: down into the channel 22 px under the centre, along, and up to the target bottom', () => {
		const bracket = linkBracket(anchor(100, 1), anchor(300, 1));
		expect(bracket.points).toEqual([
			{ x: 100.5, y: 88 },
			{ x: 100.5, y: 100.5 },
			{ x: 300.5, y: 100.5 },
			{ x: 300.5, y: 88 }
		]);
		// The bar sits just above the line's end, between it and the target.
		expect(bracket.tick).toEqual({ x: 298, y: 87 });
	});

	it('a row below: the same channel, then down to the target top edge', () => {
		const bracket = linkBracket(anchor(100, 0), anchor(40, 2));
		expect(bracket.points).toEqual([
			{ x: 100.5, y: 36 },
			{ x: 100.5, y: 48.5 },
			{ x: 40.5, y: 48.5 },
			{ x: 40.5, y: 120 }
		]);
		expect(bracket.tick).toEqual({ x: 38, y: 120 });
	});

	it('a row above: the channel runs 22 px above the centre and the last leg rises to the target bottom', () => {
		const bracket = linkBracket(anchor(100, 2), anchor(250, 0));
		expect(bracket.points).toEqual([
			{ x: 100.5, y: 120 },
			{ x: 100.5, y: 108.5 },
			{ x: 250.5, y: 108.5 },
			{ x: 250.5, y: 36 }
		]);
		expect(bracket.tick).toEqual({ x: 248, y: 35 });
	});

	it('several targets share the trunk and fan out along one channel', () => {
		const trunk = anchor(100, 1);
		const a = linkBracket(trunk, anchor(300, 1));
		const b = linkBracket(trunk, anchor(20, 3));
		expect(a.points.slice(0, 2)).toEqual(b.points.slice(0, 2));
		expect(a.points[2].y).toBe(b.points[2].y);
	});

	it('snaps the lines to the pixel grid and honours the channel distance given', () => {
		const bracket = linkBracket(anchor(99.7, 0), anchor(120.2, 0), 10);
		expect(bracket.points.map((p) => p.x)).toEqual([100.5, 100.5, 120.5, 120.5]);
		expect(bracket.points[1].y).toBe(36.5);
	});
});

describe('nearestProjection: which copy of a linked record the bracket goes to', () => {
	const copies = [{ rowIndex: 0 }, { rowIndex: 2 }, { rowIndex: 4 }];

	it('prefers the copy in the trunk row, else the nearest row, the upper one on a tie', () => {
		expect(nearestProjection(copies, 2)).toBe(copies[1]);
		expect(nearestProjection(copies, 3)).toBe(copies[1]);
		expect(nearestProjection(copies, 5)).toBe(copies[2]);
	});

	it('is nothing for a record without a place on the ribbon', () => {
		expect(nearestProjection([], 1)).toBeNull();
		expect(nearestProjection(undefined, 1)).toBeNull();
	});
});
