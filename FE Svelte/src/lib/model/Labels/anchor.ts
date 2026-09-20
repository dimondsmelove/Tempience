import { SELECTION_RING_GAP_PX, SELECTION_RING_STROKE_PX } from '$lib/model/MarkStyle/constants';
import { markExtent, markStyle, wovenColours } from '$lib/model/MarkStyle/MarkStyle';
import { CAPTION_GAP_PX } from './constants';
import type { MarkBox } from './types';

/** The room every caption leaves for the selection ring — gap and stroke — so a selection never moves the text. */
export const RING_ALLOWANCE_PX = SELECTION_RING_GAP_PX + SELECTION_RING_STROKE_PX;

/**
 * Where the caption of a mark starts (DESIGN.md §5; owner review 2026-09-19, pack 4, A):
 * after the silhouette as drawn — the capsule a point widens to, the band of a span, as
 * `markExtent` gives it, so a wide box at a close zoom counts in full — then the ring's
 * room, then `CAPTION_GAP_PX`. The same for a plain and a selected mark: the ring's room
 * is reserved always, so the text stands still while the ring comes and goes.
 */
export const captionStart = (box: MarkBox): number => {
	const extent = markExtent(
		box,
		markStyle(box.mark, { selected: false }),
		wovenColours(box.mark.colours)
	);
	return extent.x + extent.w + RING_ALLOWANCE_PX + CAPTION_GAP_PX;
};
