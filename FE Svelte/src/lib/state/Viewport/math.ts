import { DAY_MS } from './constants';
import type { TimeWindow, ViewportLimits } from './types';

export const spanOf = (window: TimeWindow): number => window.end - window.start;

/** Keeps the span inside its limits, then slides the window back inside the bounds. */
export const clampWindow = (window: TimeWindow, limits: ViewportLimits): TimeWindow => {
	let { start, end } = window;
	const span = end - start;
	if (span < limits.minSpanMs) {
		const centre = (start + end) / 2;
		start = centre - limits.minSpanMs / 2;
		end = centre + limits.minSpanMs / 2;
	} else if (span > limits.maxSpanMs) {
		const centre = (start + end) / 2;
		start = centre - limits.maxSpanMs / 2;
		end = centre + limits.maxSpanMs / 2;
	}
	if (start < limits.minStart) {
		end += limits.minStart - start;
		start = limits.minStart;
	}
	if (end > limits.maxEnd) {
		start -= end - limits.maxEnd;
		end = limits.maxEnd;
	}
	return { start, end };
};

/** Scales the span by `factor` around `anchor`, which stays at the same pixel. */
export const zoomWindow = (window: TimeWindow, factor: number, anchor: number): TimeWindow => ({
	start: anchor - (anchor - window.start) * factor,
	end: anchor + (window.end - anchor) * factor
});

export const panWindow = (window: TimeWindow, deltaMs: number): TimeWindow => ({
	start: window.start + deltaMs,
	end: window.end + deltaMs
});

/** A window of `spanMs` with `centre` placed at `pastRatio` of the width. */
export const spanWindow = (centre: number, spanMs: number, pastRatio: number): TimeWindow => ({
	start: centre - spanMs * pastRatio,
	end: centre + spanMs * (1 - pastRatio)
});

/** A window around a range with proportional padding, never tighter than a day each side. */
export const fitWindow = (start: number, end: number, padRatio: number): TimeWindow => {
	const pad = Math.max((end - start) * padRatio, DAY_MS);
	return { start: start - pad, end: end + pad };
};

/** The window that keeps «сейчас» at `nowRatio` of the width for a given span. */
export const followWindow = (now: number, spanMs: number, nowRatio: number): TimeWindow => ({
	start: now - spanMs * nowRatio,
	end: now + spanMs * (1 - nowRatio)
});

export const timeAtPx = (window: TimeWindow, px: number, widthPx: number): number =>
	window.start + (px / widthPx) * spanOf(window);

export const pxAtTime = (window: TimeWindow, t: number, widthPx: number): number =>
	((t - window.start) / spanOf(window)) * widthPx;

export const pxPerDay = (window: TimeWindow, widthPx: number): number =>
	widthPx / (spanOf(window) / DAY_MS);
