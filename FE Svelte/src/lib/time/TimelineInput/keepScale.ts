import type { Attachment } from 'svelte/attachments';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { rescaleWindow, type RibbonBox } from '$lib/state/Viewport/math';
import type { TimeRange } from '$lib/model/Projection/types';
import { KEEP_SCALE_MIN_PX } from './constants';

/**
 * Whether the person has done anything since the page loaded — a press, a key, a wheel. Until
 * then the layout is still settling (the rail takes its width a frame after the data is in), and
 * the window the app opens on keeps its time, so «сейчас» stays where it was placed.
 */
let acted = false;
if (typeof window !== 'undefined')
	for (const type of ['pointerdown', 'keydown', 'wheel'])
		window.addEventListener(type, () => (acted = true), { capture: true, once: true });

/**
 * Keeps the ribbon's scale when it changes size on screen — the Context opening or closing
 * beside it, the rail folding: every record stays at its pixel instead of the same time
 * being squeezed into the new width (owner, 2026-09-29). A selected record the Context now
 * covers is brought back into view at the same scale. «Сейчас» following keeps its own rule.
 * A ribbon collapsed or hidden for a moment (another view on the phone) is no scale to keep:
 * widths under `KEEP_SCALE_MIN_PX` are skipped, and the phone, whose Context is a sheet under
 * the ribbon, never asks for it. Before the person's first action the opening window keeps its
 * time instead (see `acted`); from then on every change of size keeps the scale.
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
				viewport.follow ||
				!acted
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
