import type { MarkBox } from '$lib/model/Labels/types';
import {
	BAND_RADIUS_PX,
	CAPSULE_RADIUS_PX,
	HOLLOW_RADIUS_PX,
	SELECTION_RING_GAP_PX
} from '$lib/model/MarkStyle/constants';
import { capsuleWidth, markExtent } from '$lib/model/MarkStyle/MarkStyle';
import type { MarkStyle, Rect, WeaveMode } from '$lib/model/MarkStyle/types';
import { tickRects, weaveRects } from '$lib/model/MarkStyle/weave';
import { PULSE_EXPAND_PX } from '$lib/model/Pulse/constants';
import { SELECTION_RING_RADIUS_PX } from './constants';

/** Begins a rounded rectangle path; a plain rectangle where `roundRect` is missing. */
export const roundedPath = (
	g: CanvasRenderingContext2D,
	{ x, y, w, h }: Rect,
	radius: number
): void => {
	g.beginPath();
	if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, Math.min(radius, w / 2, h / 2));
	else g.rect(x, y, w, h);
};
const rounded = roundedPath;

/** One colour fills the shape; several weave it — layers or stripes — inside the shape's clip. */
export const paintWoven = (
	g: CanvasRenderingContext2D,
	colours: readonly string[],
	mode: WeaveMode,
	rect: Rect,
	radius: number
): void => {
	if (colours.length === 1) {
		g.fillStyle = colours[0];
		rounded(g, rect, radius);
		g.fill();
		return;
	}
	g.save();
	rounded(g, rect, radius);
	g.clip();
	for (const piece of weaveRects(colours, mode, rect)) {
		g.fillStyle = piece.colour;
		g.fillRect(piece.x, piece.y, piece.w, piece.h);
	}
	g.restore();
};

/** The dotted tick of an intention: the dots clip the (woven) fill. */
const paintTick = (g: CanvasRenderingContext2D, colours: readonly string[], rect: Rect): void => {
	g.save();
	g.beginPath();
	for (const dot of tickRects(rect)) g.rect(dot.x, dot.y, dot.w, dot.h);
	g.clip();
	paintWoven(g, colours, 'layers', rect, 0);
	g.restore();
};

/**
 * Renders one mark as `markStyle` decided it, in the colours of its row: the
 * band (stripes when woven), then the solid head or capsule (layers), then the
 * tick, or the hollow contour alone; the selection ring in ink outside it all.
 * The box is the projection's: an open interval (C5) arrives as a box to «сейчас».
 */
export const drawMarkBox = (
	g: CanvasRenderingContext2D,
	box: MarkBox,
	style: MarkStyle,
	colours: readonly string[],
	ink: string
): void => {
	const woven = colours.length > 1;
	const narrow = capsuleWidth(woven);
	const extent = markExtent(box, style, woven);
	const y = Math.round(box.y0);
	const h = Math.max(1, Math.round(box.y1) - y);
	g.save();
	g.globalAlpha = style.alpha;
	if (style.hollow) {
		g.strokeStyle = colours[0];
		g.lineWidth = 1;
		rounded(g, { x: extent.x + 0.5, y: y + 0.5, w: extent.w - 1, h: h - 1 }, HOLLOW_RADIUS_PX);
		g.stroke();
	} else {
		if (style.band !== null) {
			g.globalAlpha = style.alpha * style.band;
			paintWoven(g, colours, 'stripes', { x: extent.x, y, w: extent.w, h }, BAND_RADIUS_PX);
		}
		const head: Rect = { x: extent.x, y, w: style.span ? narrow : extent.w, h };
		if (style.capsule !== null) {
			g.globalAlpha = style.alpha * style.capsule;
			paintWoven(g, colours, 'layers', head, CAPSULE_RADIUS_PX);
		}
		if (style.tick) {
			g.globalAlpha = style.alpha;
			const x = style.span ? head.x : Math.round(head.x + (head.w - narrow) / 2);
			paintTick(g, colours, { x, y, w: narrow, h });
		}
	}
	if (style.ring) {
		g.globalAlpha = 1;
		g.strokeStyle = ink;
		g.lineWidth = 1;
		const gap = SELECTION_RING_GAP_PX + 0.5;
		rounded(
			g,
			{ x: extent.x - gap, y: y - gap, w: extent.w + 2 * gap, h: h + 2 * gap },
			SELECTION_RING_RADIUS_PX
		);
		g.stroke();
	}
	g.restore();
};

/**
 * «Куда смотреть» (loop 008, C3): one ring of ink, 1 px, starting where the selection ring
 * sits and growing outward by `PULSE_EXPAND_PX` while it fades, over the progress 0…1. Drawn
 * after everything, so the veil never covers it.
 */
export const drawPulseRing = (
	g: CanvasRenderingContext2D,
	box: MarkBox,
	style: Pick<MarkStyle, 'span' | 'hollow'>,
	woven: boolean,
	progress: number,
	ink: string
): void => {
	if (progress >= 1) return;
	const extent = markExtent(box, style, woven);
	const y = Math.round(box.y0);
	const h = Math.max(1, Math.round(box.y1) - y);
	const gap = SELECTION_RING_GAP_PX + 0.5 + progress * PULSE_EXPAND_PX;
	g.save();
	g.globalAlpha = 1 - progress;
	g.strokeStyle = ink;
	g.lineWidth = 1;
	rounded(
		g,
		{ x: extent.x - gap, y: y - gap, w: extent.w + 2 * gap, h: h + 2 * gap },
		SELECTION_RING_RADIUS_PX + progress * PULSE_EXPAND_PX
	);
	g.stroke();
	g.restore();
};
