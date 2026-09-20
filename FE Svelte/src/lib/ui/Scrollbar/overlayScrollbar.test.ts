import { describe, expect, it } from 'vitest';
import { dragScrollTop, pageScrollTop, thumbGeometry } from './geometry';

describe('thumbGeometry', () => {
	it('is nothing when the content fits', () => {
		expect(thumbGeometry(0, 300, 300)).toBeNull();
		expect(thumbGeometry(0, 200, 300)).toBeNull();
	});

	it('sizes the thumb by the visible share and moves it by the scrolled share', () => {
		expect(thumbGeometry(0, 1000, 500)).toEqual({ heightPx: 250, offsetPx: 0 });
		expect(thumbGeometry(500, 1000, 500)).toEqual({ heightPx: 250, offsetPx: 250 });
		expect(thumbGeometry(250, 1000, 500)).toEqual({ heightPx: 250, offsetPx: 125 });
	});

	it('keeps a grabbable minimum and clamps an overscrolled position', () => {
		expect(thumbGeometry(0, 100_000, 400, 24)?.heightPx).toBe(24);
		expect(thumbGeometry(99_999, 100_000, 400, 24)?.offsetPx).toBeCloseTo(376, 5);
		expect(thumbGeometry(-50, 1000, 500)?.offsetPx).toBe(0);
	});
});

describe('dragScrollTop', () => {
	it('scales the pointer’s travel from the thumb’s room to the hidden content', () => {
		// 1000 px of content in a 500 px port: the thumb is 250 px, its room 250 px, the hidden 500 px — 2 px per px.
		expect(dragScrollTop(0, 100, 1000, 500, 250)).toBe(200);
		expect(dragScrollTop(200, -50, 1000, 500, 250)).toBe(100);
		// The scroll continues from where the grab found it.
		expect(dragScrollTop(300, 25, 1000, 500, 250)).toBe(350);
	});

	it('is exact where the thumb lands: dragging it to the end scrolls to the end', () => {
		const thumb = thumbGeometry(0, 1000, 500)!;
		expect(dragScrollTop(0, 500 - thumb.heightPx, 1000, 500, thumb.heightPx)).toBe(500);
		// A minimum-height thumb has more room than its share says; the scale follows the room.
		const tiny = thumbGeometry(0, 100_000, 400, 24)!;
		expect(dragScrollTop(0, 400 - tiny.heightPx, 100_000, 400, tiny.heightPx)).toBe(99_600);
	});

	it('never leaves the content, and does nothing when there is nothing to scroll', () => {
		expect(dragScrollTop(0, -100, 1000, 500, 250)).toBe(0);
		expect(dragScrollTop(400, 1000, 1000, 500, 250)).toBe(500);
		expect(dragScrollTop(0, 100, 300, 300, 300)).toBe(0);
		expect(dragScrollTop(0, 100, 1000, 500, 500)).toBe(0);
	});
});

describe('pageScrollTop', () => {
	const thumb = { heightPx: 250, offsetPx: 125 };
	it('pages one port up above the thumb, one port down below it, and stays on the thumb', () => {
		expect(pageScrollTop(250, 400, thumb, 1000, 500)).toBe(500);
		expect(pageScrollTop(250, 10, thumb, 1000, 500)).toBe(0);
		expect(pageScrollTop(250, 200, thumb, 1000, 500)).toBe(250);
	});
	it('clamps to the content', () => {
		expect(pageScrollTop(400, 490, thumb, 1000, 500)).toBe(500);
		expect(pageScrollTop(50, 0, thumb, 1000, 500)).toBe(0);
	});
});
