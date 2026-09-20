import { describe, expect, it } from 'vitest';
import { SELECTION_RING_GAP_PX, SELECTION_RING_STROKE_PX } from '$lib/model/MarkStyle/constants';
import { markExtent, markStyle } from '$lib/model/MarkStyle/MarkStyle';
import type { Mark } from '$lib/model/Projection/types';
import { captionStart, RING_ALLOWANCE_PX } from './anchor';
import { CAPTION_GAP_PX } from './constants';
import type { MarkBox } from './types';

const mark = (patch: Partial<Mark> = {}): Mark => ({
	id: 'a@r',
	traceId: 'a',
	rowId: 'r',
	kind: 'moment',
	intent: false,
	rollup: false,
	start: 0,
	end: 0,
	label: 'a',
	timeLabel: '',
	precision: 'day',
	certainty: 'exact',
	...patch
});
const box = (x0: number, x1: number, patch: Partial<Mark> = {}): MarkBox => ({
	mark: mark(patch),
	track: 0,
	x0,
	x1,
	y0: 10,
	y1: 26
});
/** The right edge of the mark as the canvas draws it, selected or not. */
const drawnRight = (b: MarkBox, woven = false): number => {
	const extent = markExtent(b, markStyle(b.mark, { selected: false }), woven);
	return extent.x + extent.w;
};
const CLEAR = RING_ALLOWANCE_PX + CAPTION_GAP_PX;

describe('captionStart (owner review 2026-09-19, pack 4, A)', () => {
	it('reserves the ring and the gap past the drawn silhouette at every zoom', () => {
		expect(RING_ALLOWANCE_PX).toBe(SELECTION_RING_GAP_PX + SELECTION_RING_STROKE_PX);
		// A far zoom: the box is 2 px, the capsule drawn around it 3 px — the caption clears the capsule.
		const far = box(100, 102);
		expect(drawnRight(far)).toBe(103);
		expect(captionStart(far)).toBe(103 + CLEAR);
		// A close zoom: the box widens to 8 px and so does the capsule — the caption moves out with it.
		const close = box(96, 104);
		expect(drawnRight(close)).toBe(104);
		expect(captionStart(close)).toBe(104 + CLEAR);
		expect(captionStart(close) - drawnRight(close)).toBe(captionStart(far) - drawnRight(far));
	});

	it('does not depend on the selection: the ring finds its room already there', () => {
		const b = box(96, 104);
		const ring = markExtent(b, markStyle(b.mark, { selected: true }), false);
		expect(ring).toEqual(markExtent(b, markStyle(b.mark, { selected: false }), false));
		expect(captionStart(b)).toBe(ring.x + ring.w + CLEAR);
	});

	it('follows the band of a span, the 7 px contour of a proposal and the 4 px capsule of a woven mark', () => {
		const span = box(20, 120, { kind: 'interval', end: 1 });
		expect(captionStart(span)).toBe(120 + CLEAR);
		// A short band is drawn at least 6 px wide; the caption clears the drawn band.
		expect(captionStart(box(20, 22, { kind: 'interval', end: 1 }))).toBe(26 + CLEAR);
		const hollow = box(100, 102, { proposal: true });
		expect(captionStart(hollow)).toBe(drawnRight(hollow) + CLEAR);
		expect(drawnRight(hollow) - 100).toBeGreaterThanOrEqual(5);
		const woven = box(100, 102, {
			colours: [
				{ hue: 10, chroma: null },
				{ hue: 200, chroma: null }
			]
		});
		expect(captionStart(woven)).toBe(drawnRight(woven, true) + CLEAR);
		const plain = box(100, 102, { colours: [{ hue: 10, chroma: null }] });
		expect(captionStart(plain)).toBe(drawnRight(plain, false) + CLEAR);
	});
});
