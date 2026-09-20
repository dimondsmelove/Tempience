import type { TimeRange } from '$lib/model/Projection/types';
import {
	DENSITY_MAX_ALPHA,
	FRAME_FILL_ALPHA,
	INLAY_WIDTH_PX,
	OVERVIEW_HEIGHT_PX
} from './constants';
import type { OverviewInlay, OverviewPalette } from './types';

export type DrawOverviewInput = Readonly<{
	context: CanvasRenderingContext2D;
	dpr: number;
	widthPx: number;
	range: TimeRange;
	window: TimeRange;
	now: number;
	bins: Float32Array;
	/** The colour inlays over the grey band (Q2-E); none draws the strip as before. */
	inlays?: readonly OverviewInlay[];
	palette: OverviewPalette;
}>;

/**
 * Density as brightness across the whole data range, the window as a frame (DP9); over the
 * grey band, at the time of every shown record with a coloured Scope, a 2 px inlay in its
 * Scope's colour across the band's height — two Scopes, two layers (Q2-E, owner 2026-09-19).
 */
export const drawOverview = (input: DrawOverviewInput): void => {
	const { context: g, dpr, widthPx: W, range, window, palette, bins, inlays = [] } = input;
	const H = OVERVIEW_HEIGHT_PX;
	const x = (t: number): number => ((t - range.start) / (range.end - range.start)) * W;
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, W, H);

	const binWidth = W / bins.length;
	g.fillStyle = palette.ink;
	for (let i = 0; i < bins.length; i += 1) {
		if (bins[i] <= 0) continue;
		g.globalAlpha = 0.12 + bins[i] * (DENSITY_MAX_ALPHA - 0.12);
		g.fillRect(i * binWidth, 4, Math.ceil(binWidth), H - 8);
	}
	g.globalAlpha = 1;

	const x0 = Math.max(0, x(window.start));
	const x1 = Math.min(W, x(window.end));
	g.fillStyle = palette.accent;
	g.globalAlpha = FRAME_FILL_ALPHA;
	g.fillRect(x0, 1, x1 - x0, H - 2);
	g.globalAlpha = 1;

	// The inlays over the band and the frame's wash, so a Scope's colour reads unmixed; the
	// band's own height (4..H-4), one layer per colour from the top.
	for (const inlay of inlays) {
		const left = Math.round(x(inlay.t));
		if (left + INLAY_WIDTH_PX < 0 || left > W) continue;
		const layer = (H - 8) / inlay.colours.length;
		g.globalAlpha = inlay.alpha;
		inlay.colours.forEach((colour, index) => {
			g.fillStyle = palette.scope(colour);
			g.fillRect(left, 4 + index * layer, INLAY_WIDTH_PX, layer);
		});
	}
	g.globalAlpha = 1;

	g.strokeStyle = palette.accent;
	g.lineWidth = 1;
	g.strokeRect(Math.round(x0) + 0.5, 1.5, Math.max(1, Math.round(x1 - x0) - 1), H - 3);

	const nowX = x(input.now);
	if (nowX >= 0 && nowX <= W) {
		g.beginPath();
		g.moveTo(Math.round(nowX) + 0.5, 0);
		g.lineTo(Math.round(nowX) + 0.5, H);
		g.stroke();
	}
};
