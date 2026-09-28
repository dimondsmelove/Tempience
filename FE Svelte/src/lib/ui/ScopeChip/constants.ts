/**
 * How much of the Scope's colour the chip takes (owner review 2026-09-19, п. 10/26):
 * the chip itself is tinted, not a dot inside it. The text stays ink, so the tint has to
 * remain a wash in both themes — 18 % under the text, 55 % on the edge.
 */
export const TINT_BACKGROUND_PERCENT = 18;
export const TINT_BORDER_PERCENT = 55;

/** An ancestor shrinks no narrower than this before the path collapses to «…» (px). */
export const PATH_MIN_ANCESTOR_PX = 28;
/** What stands for the ancestors a collapsed path leaves out. */
export const PATH_ELLIPSIS = '…';
