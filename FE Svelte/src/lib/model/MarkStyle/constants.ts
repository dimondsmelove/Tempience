/** Marks draw in full force (research п. 18): 0.9 base, 1 for the selected and the lit (hovered) record. */
export const MARK_ALPHA = 0.9;
export const SELECTED_ALPHA = 1;
/** A collapsed subtree shown through its group: the only dimness left (п. 3). */
export const ROLLUP_ALPHA = 0.3;
/** The band of an interval or a fuzzy date, as a share of the tone (п. 3, 14). */
export const BAND_TONE = 0.3;
/** The capsule under a closed intention's tick, so the tick still reads (п. 12). */
export const CLOSED_GAP_TONE = 0.45;

/** The selection ring: 1 px of ink this far outside the silhouette (п. 4); captions keep clear of it whether it is drawn or not. */
export const SELECTION_RING_GAP_PX = 2;
export const SELECTION_RING_STROKE_PX = 1;

/** A fact and an interval head are this wide; woven marks one pixel more (п. 3). */
export const CAPSULE_WIDTH_PX = 3;
export const WOVEN_CAPSULE_WIDTH_PX = 4;
export const CAPSULE_RADIUS_PX = 1.5;
export const BAND_RADIUS_PX = 2;
/** A band is at least this wide, so it shows past its head. */
export const BAND_MIN_WIDTH_PX = 6;
/** A proposed moment is a hollow capsule this wide (п. 13). */
export const HOLLOW_MOMENT_WIDTH_PX = 7;
export const HOLLOW_RADIUS_PX = 2;

/** The intention tick: dots and gaps along the height. */
export const TICK_DOT_PX = 3;
export const TICK_GAP_PX = 2;
/** «Полосы»: alternating colours along a band, one stripe this wide. */
export const STRIPE_PX = 4;
