import type { Caption } from '$lib/model/Labels/types';
import {
	CAPTION_PLATE_ALPHA,
	CAPTION_PLATE_PAD_X_PX,
	CAPTION_PLATE_PAD_Y_PX,
	CAPTION_PLATE_RADIUS_PX
} from './constants';
import { roundedPath } from './marks';
import type { CanvasMetrics, CanvasPalette } from './types';

/**
 * Paints resolved captions: 12/400 ink-secondary, the strong ones 12/600 ink, never
 * the Scope colour; a caption on a backing sits on a plate of the page tone (п. 5);
 * a missed record's at 18 %. The same brush draws them at rest and again above the veil.
 */
export const paintCaptions = (
	g: CanvasRenderingContext2D,
	captions: Iterable<Caption>,
	palette: CanvasPalette,
	metrics: CanvasMetrics
): void => {
	const regular = `${metrics.captionPx}px ${palette.sans}`;
	const strong = `600 ${metrics.captionPx}px ${palette.sans}`;
	g.textBaseline = 'top';
	for (const caption of captions) {
		const { label } = caption;
		if (caption.backing) {
			g.fillStyle = palette.canvas;
			g.globalAlpha = CAPTION_PLATE_ALPHA * caption.alpha;
			roundedPath(
				g,
				{
					x: label.x - CAPTION_PLATE_PAD_X_PX,
					y: label.y - CAPTION_PLATE_PAD_Y_PX,
					w: label.width + 2 * CAPTION_PLATE_PAD_X_PX,
					h: label.height + 2 * CAPTION_PLATE_PAD_Y_PX
				},
				CAPTION_PLATE_RADIUS_PX
			);
			g.fill();
		}
		g.globalAlpha = caption.alpha;
		g.font = caption.strong ? strong : regular;
		g.fillStyle = caption.strong ? palette.ink : palette.inkSecondary;
		g.fillText(label.text, label.x, label.y);
	}
	g.globalAlpha = 1;
};
