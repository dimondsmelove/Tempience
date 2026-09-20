/**
 * Clear room between the selection ring's outer edge and the caption, in pixels: the caption
 * starts after the drawn silhouette plus the ring's room, reserved whether the record is
 * selected or not, so the text never touches the ring and never moves when it appears
 * (owner review 2026-09-19, pack 4, A).
 */
export const CAPTION_GAP_PX = 6;
/** Free room a caption needs beyond its own width before the next mark in the track (DESIGN.md §5). */
export const LABEL_CLEARANCE_PX = 10;
export const LABEL_FONT_PX = 12;
/** Row width per caption at rest: at most one caption per this many px of the canvas (Q1-A, owner 2026-09-19). */
export const CAPTION_BUDGET_PX = 200;
/** Longest caption at rest, in characters; a longer text is cut on a word boundary and ends with «…» (Q1-A). */
export const CAPTION_MAX_CHARS = 44;
/** A word boundary earlier than this would cut too much: the text is cut hard at the limit instead. */
export const CAPTION_MIN_CUT_CHARS = 22;
/** Windows of this many days and longer are the «год» tier: captions only for intentions, «длится» and intervals (Q1-A). */
export const YEAR_TIER_MIN_DAYS = 300;
/** Windows shorter than this are the «неделя»/«день» tier; between the two limits lies «квартал»/«месяц» (the 30-day preset included). */
export const WEEK_TIER_MAX_DAYS = 20;
/** Forced captions keep this much clear of each other: a plate, padded by as much, never covers a neighbour's text. */
export const FORCED_CAPTION_GAP_PX = 4;
