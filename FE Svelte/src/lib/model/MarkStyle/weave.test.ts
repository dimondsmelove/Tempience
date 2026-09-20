import { describe, expect, it } from 'vitest';
import { tickRects, weaveRects } from './weave';

const box = { x: 10, y: 20, w: 12, h: 16 };

describe('weaveRects: several Scope colours on one mark', () => {
	it('one colour is one rectangle in either mode', () => {
		expect(weaveRects(['a'], 'layers', box)).toEqual([{ colour: 'a', ...box }]);
		expect(weaveRects(['a'], 'stripes', box)).toEqual([{ colour: 'a', ...box }]);
	});

	it('«Слои»: one horizontal layer per colour, overlapping half a pixel so no seam shows', () => {
		expect(weaveRects(['a', 'b'], 'layers', box)).toEqual([
			{ colour: 'a', x: 10, y: 20, w: 12, h: 8.5 },
			{ colour: 'b', x: 10, y: 28, w: 12, h: 8 }
		]);
		const three = weaveRects(['a', 'b', 'c'], 'layers', { ...box, h: 12 });
		expect(three.map((r) => [r.colour, r.y, r.h])).toEqual([
			['a', 20, 4.5],
			['b', 24, 4.5],
			['c', 28, 4]
		]);
	});

	it('«Полосы»: 4 px stripes cycle through the colours along the length, the last one cut', () => {
		const rects = weaveRects(['a', 'b', 'c'], 'stripes', { ...box, w: 14 });
		expect(rects.map((r) => [r.colour, r.x, r.w])).toEqual([
			['a', 10, 4],
			['b', 14, 4],
			['c', 18, 4],
			['a', 22, 2]
		]);
		expect(rects.every((r) => r.y === 20 && r.h === 16)).toBe(true);
	});

	it('stripes fall back to layers when the mark is too narrow for one stripe per colour', () => {
		expect(weaveRects(['a', 'b'], 'stripes', { ...box, w: 7 })).toEqual(
			weaveRects(['a', 'b'], 'layers', { ...box, w: 7 })
		);
	});
});

describe('tickRects: the dotted tick of an intention', () => {
	it('is 3 px dots with 2 px gaps down the box, the last dot cut at the edge', () => {
		expect(tickRects({ x: 4, y: 0, w: 3, h: 16 }).map((r) => [r.y, r.h])).toEqual([
			[0, 3],
			[5, 3],
			[10, 3],
			[15, 1]
		]);
		expect(tickRects({ x: 4, y: 0, w: 3, h: 3 })).toEqual([{ x: 4, y: 0, w: 3, h: 3 }]);
	});
});
