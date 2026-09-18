import { LABEL_CLEARANCE_PX, LABEL_GAP_PX } from './constants';
import type { LabelBox, LabelOptions, MarkBox } from './types';

/**
 * Captions by the rule of DESIGN.md §5: next to the mark, no backdrop, only
 * when the room up to the next mark in the same track holds the text plus
 * 10 px. Captions never overlap each other across tracks. The selected
 * record's caption is always placed. Roll-up marks and fuzzy underlays get a
 * caption only while selected.
 */
const overlaps = (a: LabelBox, b: LabelBox): boolean =>
	a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const placeLabels = (boxes: readonly MarkBox[], options: LabelOptions): LabelBox[] => {
	const boundedY = (y: number): number =>
		options.bounds
			? Math.max(options.bounds.top, Math.min(y, options.bounds.bottom - options.fontPx))
			: y;
	const byTrack = new Map<number, MarkBox[]>();
	for (const box of boxes) {
		if (box.track < 0) continue;
		(byTrack.get(box.track) ?? byTrack.set(box.track, []).get(box.track))!.push(box);
	}
	const labels: LabelBox[] = [];
	const place = (box: MarkBox, free: number): void => {
		const selected = box.mark.traceId === options.selectedTraceId;
		if (!selected && box.mark.rollup) return;
		if (box.x1 > options.widthPx) return;
		const width = options.measure(box.mark.label);
		if (box.x1 + LABEL_GAP_PX + width < 0) return;
		if (!selected && free < width + LABEL_CLEARANCE_PX) return;
		const label: LabelBox = {
			markId: box.mark.id,
			text: box.mark.label,
			x: box.x1 + LABEL_GAP_PX,
			y: boundedY((box.y0 + box.y1) / 2 - options.fontPx / 2),
			width,
			height: options.fontPx,
			selected
		};
		if (!selected && labels.some((other) => overlaps(other, label))) return;
		labels.push(label);
	};
	for (const track of byTrack.values()) {
		track.sort((a, b) => a.x0 - b.x0 || a.mark.id.localeCompare(b.mark.id));
		for (let i = 0; i < track.length; i += 1) {
			const next = track[i + 1];
			place(track[i], next ? next.x0 - track[i].x1 - LABEL_GAP_PX : Infinity);
		}
	}
	for (const box of boxes) {
		if (box.track >= 0 || box.mark.traceId !== options.selectedTraceId) continue;
		const width = options.measure(box.mark.label);
		labels.push({
			markId: box.mark.id,
			text: box.mark.label,
			x: Math.max(0, box.x0) + LABEL_GAP_PX,
			y: boundedY(box.y0 - options.fontPx - 2),
			width,
			height: options.fontPx,
			selected: true
		});
	}
	return labels;
};
