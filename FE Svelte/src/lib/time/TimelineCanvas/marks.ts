import type { MarkBox } from '$lib/model/Labels/types';
import {
	FUZZY_DASH,
	PROPOSAL_DASH,
	INTERVAL_FILL_RATIO,
	CLOSED_INTENT_FILL_ALPHA,
	MARK_ALPHA,
	MARK_RADIUS_PX,
	ROLLUP_ALPHA,
	SELECTED_INTENT_FILL_ALPHA
} from './constants';
import type { CanvasPalette } from './types';

const roundedPath = (
	g: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number
): void => {
	g.beginPath();
	if (w >= 3 * MARK_RADIUS_PX && h >= 3 * MARK_RADIUS_PX && typeof g.roundRect === 'function')
		g.roundRect(x, y, w, h, MARK_RADIUS_PX);
	else g.rect(x, y, w, h);
};

/**
 * One mark in the label language (DESIGN.md §5): a moment is an ink fill, an
 * interval a 45 % fill with a 1 px frame, an intent the same silhouette
 * hollow, a fuzzy date a dashed underlay. Selection swaps ink for accent.
 */
export const drawMarkBox = (
	g: CanvasRenderingContext2D,
	box: MarkBox,
	palette: CanvasPalette,
	selected: boolean
): void => {
	const { mark } = box;
	const color = selected ? palette.accent : mark.proposal ? palette.secondaryInk : palette.ink;
	const alpha = selected ? 1 : mark.rollup ? ROLLUP_ALPHA : MARK_ALPHA;
	const w = box.x1 - box.x0;
	const h = box.y1 - box.y0;
	g.save();
	g.globalAlpha = alpha;
	if (mark.kind === 'fuzzy') {
		const y = (box.y0 + box.y1) / 2;
		g.strokeStyle = color;
		g.lineWidth = h;
		g.setLineDash([...FUZZY_DASH]);
		g.beginPath();
		g.moveTo(box.x0, y);
		g.lineTo(box.x1, y);
		g.stroke();
	} else if (mark.proposal) {
		g.strokeStyle = color;
		g.lineWidth = 1;
		g.setLineDash([...PROPOSAL_DASH]);
		roundedPath(g, box.x0 + 0.5, box.y0 + 0.5, Math.max(1, w - 1), h - 1);
		g.stroke();
		if (selected) {
			g.setLineDash([]);
			g.globalAlpha = SELECTED_INTENT_FILL_ALPHA;
			g.fillStyle = color;
			g.fill();
		}
	} else if (mark.intent) {
		// A closed intention is a muted, filled silhouette: done with, still on the ribbon.
		const inkOf = mark.closed && !selected ? palette.muted : color;
		g.strokeStyle = inkOf;
		g.lineWidth = 1;
		roundedPath(g, box.x0 + 0.5, box.y0 + 0.5, Math.max(1, w - 1), h - 1);
		g.stroke();
		if (mark.closed && !selected) {
			g.globalAlpha = alpha * CLOSED_INTENT_FILL_ALPHA;
			g.fillStyle = inkOf;
			g.fill();
		} else if (selected) {
			g.globalAlpha = SELECTED_INTENT_FILL_ALPHA;
			g.fillStyle = color;
			g.fill();
		}
	} else if (mark.kind === 'interval') {
		g.fillStyle = color;
		g.globalAlpha = selected ? alpha : alpha * INTERVAL_FILL_RATIO;
		roundedPath(g, box.x0, box.y0, w, h);
		g.fill();
		g.globalAlpha = alpha;
		g.strokeStyle = color;
		g.lineWidth = 1;
		roundedPath(g, box.x0 + 0.5, box.y0 + 0.5, Math.max(1, w - 1), h - 1);
		g.stroke();
	} else {
		g.fillStyle = color;
		roundedPath(g, box.x0, box.y0, w, h);
		g.fill();
	}
	g.restore();
};
