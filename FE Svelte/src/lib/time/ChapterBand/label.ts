import { fitLabel } from '$lib/model/Chapters';
import { ADD_SLOT_PX, LABEL_GAP_PX, LABEL_PAD_PX } from './constants';

/** The room a label has from its left edge to its segment's end, short of the «+» at the band's end. */
export const labelRoom = (left: number, x1: number, bandWidth: number): number =>
	Math.min(x1, bandWidth - ADD_SLOT_PX) - left - LABEL_PAD_PX;

/** What of a chapter's label fits its room: the name (down to a stub), the dates beside it. */
export const chapterLabel = (
	room: number,
	nameWidth: number,
	datesWidth: number
): Readonly<{ name: boolean; extra: boolean }> =>
	fitLabel(room, nameWidth, LABEL_GAP_PX + datesWidth);
