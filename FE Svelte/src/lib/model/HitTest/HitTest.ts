import type { MarkBox } from '$lib/model/Labels/types';
import type { RibbonLayout } from '$lib/model/Layout/types';
import { HIT_SLOP_PX } from './constants';
import type { Cluster, Hit } from './types';

const inside = (
	box: Readonly<{ x0: number; x1: number; y0: number; y1: number }>,
	x: number,
	y: number,
	slop = 0
): boolean => x >= box.x0 - slop && x <= box.x1 + slop && y >= box.y0 - slop && y <= box.y1 + slop;

/**
 * What lies under a canvas point: a caption beats the marks it sits on, marks
 * come back topmost first (the last drawn wins), otherwise the row itself.
 */
export const hitAt = (layout: RibbonLayout, x: number, y: number): Hit | null => {
	if (x < 0 || x > layout.widthPx || y < 0) return null;
	const row = layout.rows.find((candidate) => y >= candidate.y0 && y < candidate.y1);
	if (!row) return null;
	for (let i = row.labels.length - 1; i >= 0; i -= 1) {
		const label = row.labels[i];
		if (
			inside(
				{ x0: label.x, x1: label.x + label.width, y0: label.y, y1: label.y + label.height },
				x,
				y
			)
		)
			return { type: 'label', rowId: row.row.id, label };
	}
	const boxes: MarkBox[] = [];
	for (let i = row.boxes.length - 1; i >= 0; i -= 1) {
		if (inside(row.boxes[i], x, y, HIT_SLOP_PX)) boxes.push(row.boxes[i]);
	}
	if (boxes.length > 0) return { type: 'mark', rowId: row.row.id, boxes };
	return { type: 'row', rowId: row.row.id };
};

/** Distinct records among hit boxes; a cluster when there is more than one. */
export const clusterOf = (boxes: readonly MarkBox[]): Cluster | null => {
	const traceIds = [...new Set(boxes.map((box) => box.mark.traceId))];
	if (traceIds.length < 2) return null;
	let start = Infinity,
		end = -Infinity;
	for (const box of boxes) {
		start = Math.min(start, box.mark.start);
		end = Math.max(end, box.mark.end);
	}
	return { traceIds, range: { start, end } };
};
