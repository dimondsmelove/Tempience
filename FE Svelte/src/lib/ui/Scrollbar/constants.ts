/** The thumb stays after the last scroll for this long, then fades. */
export const THUMB_HIDE_DELAY_MS = 1200;
/** A thumb never gets shorter than this, however long the content. */
export const THUMB_MIN_HEIGHT_PX = 24;
/**
 * The grabbable strip along the scroller's right edge — the rail and the thumb's hit area — is
 * this wide; the bar drawn inside it stays thin (3 px, 5 px under the pointer: `overlay.css`).
 */
export const HIT_WIDTH_PX = 10;
/** The pointer this close to the right edge calls the bar up, so it can be grabbed without scrolling first. */
export const EDGE_REVEAL_PX = 24;
