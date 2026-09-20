import type { MarkExtent } from '$lib/model/MarkStyle/types';
import {
	CLOSING_CAPTION_GAP_PX,
	CLOSING_GAP_PX,
	CLOSING_MARKER_INSET_PX,
	CLOSING_MARKER_WIDTH_PX
} from './constants';
import type { CaptionRect, ClosingGeometry, Segment } from './types';

/** Centre of a 1 px line on the pixel grid. */
const crisp = (value: number): number => Math.round(value) + 0.5;

/** A span minus the cuts, left to right; a piece survives only with room in it. */
const cut = (span: Segment, cuts: readonly Segment[]): Segment[] => {
	const pieces: Segment[] = [];
	let x0 = span.x0;
	for (const gap of cuts.toSorted((a, b) => a.x0 - b.x0)) {
		if (gap.x1 <= x0 || gap.x0 >= span.x1) continue;
		if (gap.x0 > x0) pieces.push({ x0, x1: gap.x0 });
		x0 = Math.max(x0, gap.x1);
	}
	if (x0 < span.x1) pieces.push({ x0, x1: span.x1 });
	return pieces;
};

/**
 * The closing of a closed intention while its caption is forced (loop 008, C4, mockup v5):
 * a marker — a capsule of the mark's colour at 45 %, 4 px wide, 3 px inside the track top
 * and bottom — at the closing instant, and a hairline at the track's mid-height from the
 * mark's drawn extent to the marker: from the right edge when the closing is later, to the
 * left edge when it is earlier, 2 px clear of both. A closing past the canvas edge draws
 * the line to the edge; the marker is left for the canvas to clip. A closing within the
 * mark's own extent has no line. The line yields to the captions it would cross — the text
 * stays legible, the caption never moves — so it is cut around each one, plate room included.
 * Nothing here affects the hit test or the caption placement.
 */
export const closingGeometry = (
	extent: Pick<MarkExtent, 'x' | 'w'>,
	box: Readonly<{ y0: number; y1: number }>,
	closedX: number,
	widthPx: number,
	captions: readonly CaptionRect[] = []
): ClosingGeometry => {
	const y = Math.round(box.y0);
	const h = Math.max(1, Math.round(box.y1) - y);
	const marker = {
		x: Math.round(closedX) - CLOSING_MARKER_WIDTH_PX / 2,
		y: y + CLOSING_MARKER_INSET_PX,
		w: CLOSING_MARKER_WIDTH_PX,
		h: Math.max(1, h - 2 * CLOSING_MARKER_INSET_PX)
	};
	const lineY = crisp((box.y0 + box.y1) / 2);
	const right = extent.x + extent.w;
	const span: Segment | null =
		marker.x >= right
			? { x0: right + CLOSING_GAP_PX, x1: Math.min(widthPx, marker.x - CLOSING_GAP_PX) }
			: marker.x + marker.w <= extent.x
				? { x0: Math.max(0, marker.x + marker.w + CLOSING_GAP_PX), x1: extent.x - CLOSING_GAP_PX }
				: null;
	if (!span || span.x1 <= span.x0) return { marker, lineY, segments: [] };
	const crossed = captions
		.filter((caption) => caption.y <= lineY && lineY <= caption.y + caption.height)
		.map((caption) => ({
			x0: caption.x - CLOSING_CAPTION_GAP_PX,
			x1: caption.x + caption.width + CLOSING_CAPTION_GAP_PX
		}));
	return { marker, lineY, segments: cut(span, crossed) };
};
