import type { Rect } from '$lib/model/MarkStyle/types';

/** A horizontal run of the hairline, in canvas pixels. */
export type Segment = Readonly<{ x0: number; x1: number }>;

/** What the closing reads of a caption it may cross: the text's rectangle as drawn. */
export type CaptionRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/**
 * Where a closed intention's closing draws (loop 008, C4): the marker at the closing
 * instant and the hairline from the mark to it.
 */
export type ClosingGeometry = Readonly<{
	/** The 4 px capsule at `x(closedAt)`, inset 3 px top and bottom; the canvas clips what lies past its edge. */
	marker: Rect;
	/** The hairline's y: the track's mid-height, crisp. */
	lineY: number;
	/**
	 * The hairline left to right, cut around every caption it would cross; empty when the
	 * closing lies within the mark's own extent.
	 */
	segments: readonly Segment[];
}>;
