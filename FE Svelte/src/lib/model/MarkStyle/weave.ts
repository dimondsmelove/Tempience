import { STRIPE_PX, TICK_DOT_PX, TICK_GAP_PX } from './constants';
import type { Rect, WeaveMode, WeaveRect } from './types';

/**
 * Rectangles that paint a mark in several colours at once (research п. 2):
 * «Слои» stack one horizontal layer per colour, «Полосы» alternate 4 px
 * stripes along the length. Stripes need room for one of each colour;
 * narrower marks fall back to layers. The layers overlap by half a pixel so
 * no seam shows between them. One colour is one rectangle.
 */
export const weaveRects = (
	colours: readonly string[],
	mode: WeaveMode,
	{ x, y, w, h }: Rect
): readonly WeaveRect[] => {
	const n = colours.length;
	if (n <= 1) return [{ colour: colours[0] ?? '', x, y, w, h }];
	if (mode === 'stripes' && w >= n * STRIPE_PX) {
		const rects: WeaveRect[] = [];
		for (let sx = x, i = 0; sx < x + w; sx += STRIPE_PX, i += 1)
			rects.push({ colour: colours[i % n], x: sx, y, w: Math.min(STRIPE_PX, x + w - sx), h });
		return rects;
	}
	const layer = h / n;
	return colours.map((colour, i) => ({
		colour,
		x,
		y: y + i * layer,
		w,
		h: i === n - 1 ? layer : layer + 0.5
	}));
};

/** The dots of an intention tick down a box: 3 px on, 2 px off, the last dot cut at the edge. */
export const tickRects = ({ x, y, w, h }: Rect): readonly Rect[] => {
	const rects: Rect[] = [];
	for (let dy = 0; dy < h; dy += TICK_DOT_PX + TICK_GAP_PX)
		rects.push({ x, y: y + dy, w, h: Math.min(TICK_DOT_PX, h - dy) });
	return rects;
};
