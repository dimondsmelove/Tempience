import { FORCED_CAPTION_GAP_PX } from '$lib/model/Labels/constants';

/** The closing marker: a capsule this wide, this far inside the track top and bottom (mockup v5). */
export const CLOSING_MARKER_WIDTH_PX = 4;
export const CLOSING_MARKER_INSET_PX = 3;
/** The hairline leaves the mark and meets the marker this far outside their silhouettes, as a bracket does. */
export const CLOSING_GAP_PX = 2;
/** The hairline: 1 px of ink at this alpha. */
export const CLOSING_LINE_ALPHA = 0.5;
/** The hairline keeps this much clear of a caption it would cross, on either side: the room a plate takes. */
export const CLOSING_CAPTION_GAP_PX = FORCED_CAPTION_GAP_PX;
