import { axisRows, unitBoundaries } from '$lib/model/Axis/Axis';
import type { AxisUnit } from '$lib/model/Axis/types';
import type { RibbonLayout } from '$lib/model/Layout/types';
import {
	FUTURE_TINT_ALPHA,
	MONTH_BOUNDARY_ALPHA,
	NOW_TRAIL_ALPHA,
	NOW_TRAIL_WIDTH_PX,
	YEAR_BOUNDARY_ALPHA
} from './constants';
import type { CanvasPalette } from './types';

/** The same colour at alpha 0, so a gradient fades without passing through black. */
const transparent = (colour: string): string => {
	const rgb = /^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.exec(colour);
	return rgb ? `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, 0)` : 'rgba(0, 0, 0, 0)';
};

/** A crisp 1 px vertical line at x from y0 to y1. */
export const line = (g: CanvasRenderingContext2D, x: number, y0: number, y1: number): void => {
	const px = Math.round(x) + 0.5;
	g.beginPath();
	g.moveTo(px, y0);
	g.lineTo(px, y1);
	g.stroke();
};

/**
 * The ground under the rows (research п. 6): the future tinted with the
 * secondary accent, an accent trail fading in towards «сейчас», year
 * boundaries that read and month boundaries that whisper. No grid, no zebra.
 */
export const drawGround = (
	g: CanvasRenderingContext2D,
	layout: RibbonLayout,
	palette: CanvasPalette,
	nowX: number
): void => {
	const W = layout.widthPx;
	const H = layout.heightPx;
	if (nowX < W) {
		const from = Math.max(0, nowX);
		g.fillStyle = palette.secondary;
		g.globalAlpha = FUTURE_TINT_ALPHA;
		g.fillRect(from, 0, W - from, H);
		g.globalAlpha = 1;
	}
	if (nowX > 0 && nowX - NOW_TRAIL_WIDTH_PX < W) {
		const trail = g.createLinearGradient(nowX - NOW_TRAIL_WIDTH_PX, 0, nowX, 0);
		trail.addColorStop(0, transparent(palette.accent));
		trail.addColorStop(1, palette.accent);
		g.save();
		g.fillStyle = trail;
		g.globalAlpha = NOW_TRAIL_ALPHA;
		g.fillRect(nowX - NOW_TRAIL_WIDTH_PX, 0, NOW_TRAIL_WIDTH_PX, H);
		g.restore();
	}
	// Years read at 0.9 (decades on the far scale); months whisper at 0.35 while the axis shows them.
	const { spec } = axisRows(layout.window, W);
	const strong: AxisUnit = spec.major === 'decade' ? 'decade' : 'year';
	g.strokeStyle = palette.border;
	g.lineWidth = 1;
	g.globalAlpha = YEAR_BOUNDARY_ALPHA;
	for (const period of unitBoundaries(layout.window, strong)) line(g, layout.x(period.start), 0, H);
	if (spec.major === 'month' || spec.minor === 'month') {
		g.globalAlpha = MONTH_BOUNDARY_ALPHA;
		for (const period of unitBoundaries(layout.window, 'month')) {
			if (new Date(period.start).getUTCMonth() === 0) continue;
			line(g, layout.x(period.start), 0, H);
		}
	}
	g.globalAlpha = 1;
};

/**
 * The column of a period over the rows area (loop 008, A): the accent at 6 % between
 * x(start) and x(end), clipped to the canvas. The focused period keeps it; a hovered
 * period draws it again above the veil.
 */
export const drawColumn = (
	g: CanvasRenderingContext2D,
	layout: RibbonLayout,
	range: Readonly<{ start: number; end: number }>,
	rowsBottom: number,
	colour: string,
	alpha: number
): void => {
	const x0 = Math.max(0, layout.x(range.start));
	const x1 = Math.min(layout.widthPx, layout.x(range.end));
	if (x1 <= x0) return;
	g.fillStyle = colour;
	g.globalAlpha = alpha;
	g.fillRect(x0, 0, x1 - x0, rowsBottom);
	g.globalAlpha = 1;
};
