import { captionStart } from './anchor';
import { captionBudget, captionClass, rankForBudget, tierAdmits, truncateCaption } from './budget';
import { LABEL_CLEARANCE_PX } from './constants';
import type { LabelBox, LabelOptions, MarkBox } from './types';

const NONE: ReadonlySet<string> = new Set();

/**
 * Captions by the rule of DESIGN.md §5: next to the mark — after its drawn
 * silhouette and the room of the selection ring (`captionStart`) — no backdrop,
 * only when the room up to the next mark in the same track holds the text plus
 * 10 px. Captions never overlap each other across tracks. The selected
 * record's caption is always placed, in full. Roll-up marks get a caption only
 * while selected. A fuzzy date sits in a track like an interval (decision A), so
 * its caption follows its band as any span's does.
 *
 * At rest a row shows at most one caption per `CAPTION_BUDGET_PX` of the canvas
 * (Q1-A, owner 2026-09-19): the marks are served in priority order — the
 * selected, open intentions and «длится», intervals, linked facts, other facts,
 * newer first — a text longer than `CAPTION_MAX_CHARS` is cut with «…», and the
 * tier of the scale keeps the coarse windows to intentions and intervals. A
 * record that loses the budget draws its mark alone; the lit and the matching
 * records get their captions back in full in `captions.ts`.
 */
const overlaps = (a: LabelBox, b: LabelBox): boolean =>
	a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

export const placeLabels = (boxes: readonly MarkBox[], options: LabelOptions): LabelBox[] => {
	const { selectedTraceId } = options;
	const tier = options.tier ?? 'week';
	const linked = options.linked ?? NONE;
	const boundedY = (y: number): number =>
		options.bounds
			? Math.max(options.bounds.top, Math.min(y, options.bounds.bottom - options.fontPx))
			: y;
	// Free room from a mark to the next one in its track, before either caption is placed.
	const byTrack = new Map<number, MarkBox[]>();
	for (const box of boxes)
		(byTrack.get(box.track) ?? byTrack.set(box.track, []).get(box.track))!.push(box);
	const room = new Map<string, number>();
	for (const track of byTrack.values()) {
		track.sort((a, b) => a.x0 - b.x0 || a.mark.id.localeCompare(b.mark.id));
		track.forEach((box, i) => {
			const next = track[i + 1];
			room.set(box.mark.id, next ? next.x0 - captionStart(box) : Infinity);
		});
	}
	const labels: LabelBox[] = [];
	let budget = captionBudget(options.widthPx);
	for (const box of rankForBudget(boxes, selectedTraceId, linked)) {
		const selected = box.mark.traceId === selectedTraceId;
		if (!selected && budget <= 0) break;
		if (!selected && (box.mark.rollup || !tierAdmits(tier, captionClass(box.mark, linked))))
			continue;
		if (box.x1 > options.widthPx) continue;
		const text = selected ? box.mark.label : truncateCaption(box.mark.label);
		const width = options.measure(text);
		const x = captionStart(box);
		if (x + width < 0) continue;
		if (!selected && room.get(box.mark.id)! < width + LABEL_CLEARANCE_PX) continue;
		const label: LabelBox = {
			markId: box.mark.id,
			text,
			x,
			y: boundedY((box.y0 + box.y1) / 2 - options.fontPx / 2),
			width,
			height: options.fontPx,
			selected
		};
		if (!selected && labels.some((other) => overlaps(other, label))) continue;
		labels.push(label);
		budget -= 1;
	}
	// Left to right for the hit test and the draw; the selected caption last, so it lies on top.
	return labels.sort((a, b) => Number(a.selected) - Number(b.selected) || a.x - b.x || a.y - b.y);
};
