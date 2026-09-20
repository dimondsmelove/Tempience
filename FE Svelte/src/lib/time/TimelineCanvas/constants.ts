/** Scope range band: the Scope colour at 7 %; colourless rows the border tone at 40 % (research п. 10). */
export const SCOPE_RANGE_TONE = 0.07;
export const SCOPE_RANGE_ALPHA = 0.4;
/** The ground (п. 6): the future is tinted with the secondary accent at 4 % — reads on light and dark alike. */
export const FUTURE_TINT_ALPHA = 0.04;
/** The accent trail right before «сейчас»: this wide, a gradient from nothing to this alpha at the line (п. 6). */
export const NOW_TRAIL_WIDTH_PX = 28;
export const NOW_TRAIL_ALPHA = 0.13;
/** Calendar boundaries under the rows, border tone: years read, months only whisper (п. 6); no grid otherwise. */
export const YEAR_BOUNDARY_ALPHA = 0.9;
export const MONTH_BOUNDARY_ALPHA = 0.35;
/** Brackets of the selected record's explicit links: solid ink at this alpha (п. 15). */
export const LINK_ALPHA = 0.75;
/** The dashed accent connector between the projections of the selected record (п. 4). */
export const PROJECTION_DASH: readonly number[] = [2, 4];
export const PROJECTION_ALPHA = 0.9;
/** The selection ring's corner radius; its gap is the model's `SELECTION_RING_GAP_PX`, which the captions read too (п. 4). */
export const SELECTION_RING_RADIUS_PX = 3;
/** A forced caption over a neighbour sits on a plate of the page tone: this alpha, radius, padding (п. 5). */
export const CAPTION_PLATE_ALPHA = 0.8;
export const CAPTION_PLATE_RADIUS_PX = 3;
export const CAPTION_PLATE_PAD_X_PX = 4;
export const CAPTION_PLATE_PAD_Y_PX = 3;
/** The DOM twin lists at most this many visible records. */
export const TWIN_LIMIT = 300;
/** The lens veil eases to its goal over this long (loop 008, B); reduced motion jumps. */
export const VEIL_EASE_MS = 120;
/** After the last wheel notch over the canvas the hover target holds still this long, so a zoom does not flicker it. */
export const HOVER_HOLD_MS = 150;
