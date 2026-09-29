import type { Attachment } from 'svelte/attachments';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { rescaleWindow, type RibbonBox } from '$lib/state/Viewport/math';
import type { TimeRange } from '$lib/model/Projection/types';
import { KEEP_SCALE_MIN_PX } from './constants';

/**
 * Keeps the ribbon's scale when it changes size on screen — the Context opening or closing
 * beside it, the rail folding: every record stays at its pixel instead of the same time
 * being squeezed into the new width (owner, 2026-09-29). A selected record the Context now
 * covers is brought back into view at the same scale. «Сейчас» following keeps its own rule.
 * A ribbon collapsed or hidden for a moment (another view on the phone) is no scale to keep:
 * widths under `KEEP_SCALE_MIN_PX` are skipped, and the phone, whose Context is a sheet under
 * the ribbon, never asks for it.
 */
export const keepScale =
	(viewport: ViewportState, selected: () => TimeRange | null): Attachment<HTMLElement> =>
	(element) => {
		let last: RibbonBox | null = null;
		const observer = new ResizeObserver(() => {
			const rect = element.getBoundingClientRect();
			const next: RibbonBox = { left: rect.left, width: rect.width };
			const previous = last;
			last = next;
			if (
				!previous ||
				previous.width < KEEP_SCALE_MIN_PX ||
				next.width < KEEP_SCALE_MIN_PX ||
				viewport.follow
			)
				return;
			if (Math.abs(previous.width - next.width) < 0.5 && Math.abs(previous.left - next.left) < 0.5)
				return;
			viewport.set(rescaleWindow(viewport.target, previous, next));
			const range = selected();
			if (range) viewport.reveal(range.start, range.end);
		});
		observer.observe(element);
		return () => observer.disconnect();
	};
