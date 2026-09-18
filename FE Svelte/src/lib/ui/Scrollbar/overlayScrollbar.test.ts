import { describe, expect, it } from 'vitest';
import { thumbGeometry } from './overlayScrollbar';

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
