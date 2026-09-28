import { pxAtTime } from '$lib/state/Viewport/math';
import type { TimeWindow } from '$lib/state/Viewport/types';
import { endOf, sortChapters, statusAt } from './Chapters';
import { BAND_LABEL_INSET_PX } from './constants';
import { stageAt, stageWindows } from './stages';
import { ms } from './time';
import type { BandSegment, BandStage, Chapter } from './types';

/** The chapter band above the axis: segments, their sticky labels, and a chapter's own hue. */

/**
 * Which parts of a label fit a segment's visible width: the dates only beside the whole name,
 * the name only whole or cut with an ellipsis down to a readable stub; nothing under it.
 */
export const fitLabel = (
	widthPx: number,
	nameWidthPx: number,
	extraWidthPx: number,
	stubPx = 36
): Readonly<{ name: boolean; extra: boolean }> => ({
	name: widthPx >= Math.min(nameWidthPx, stubPx),
	extra: widthPx >= nameWidthPx + extraWidthPx
});

/** The chapters as the band draws them over a window `widthPx` wide; off-screen ones are left out. */
export const bandSegments = (
	chapters: readonly Chapter[],
	window: TimeWindow,
	widthPx: number,
	now: number
): BandSegment[] => {
	const segments: BandSegment[] = [];
	for (const chapter of sortChapters(chapters)) {
		const x0 = pxAtTime(window, ms(chapter.start), widthPx);
		const end = endOf(chapter);
		const x1 = end === null ? Math.max(widthPx, x0) + 1 : pxAtTime(window, end, widthPx);
		if (x1 <= 0 || x0 >= widthPx) continue;
		const stageAtNow = stageAt(chapter, now)?.id ?? null;
		const stages: BandStage[] = [];
		for (const item of stageWindows(chapter)) {
			const s0 = pxAtTime(window, item.start, widthPx);
			const s1 = item.end === null ? x1 : pxAtTime(window, item.end, widthPx);
			if (s1 <= 0 || s0 >= widthPx) continue;
			stages.push({
				id: item.stage.id,
				name: item.stage.name,
				x0: s0,
				x1: s1,
				labelX: Math.max(s0, 0) + BAND_LABEL_INSET_PX,
				current: item.stage.id === stageAtNow
			});
		}
		segments.push({
			id: chapter.id,
			name: chapter.name,
			x0,
			x1,
			labelX: Math.max(x0, 0) + BAND_LABEL_INSET_PX,
			open: end === null,
			status: statusAt(chapter, now),
			stages
		});
	}
	return segments;
};

const hueDistance = (a: number, b: number): number => {
	const d = Math.abs(a - b) % 360;
	return Math.min(d, 360 - d);
};

/** The hue on a 5° step farthest from every hue in use, so a chapter never reads as a Scope. */
export const freeHue = (used: readonly number[]): number => {
	let best = 0;
	let bestGap = -1;
	for (let hue = 0; hue < 360; hue += 5) {
		const gap = used.length ? Math.min(...used.map((item) => hueDistance(hue, item))) : 180;
		if (gap > bestGap) {
			best = hue;
			bestGap = gap;
		}
	}
	return best;
};
