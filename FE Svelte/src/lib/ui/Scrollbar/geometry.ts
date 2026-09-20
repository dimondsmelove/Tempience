import { THUMB_MIN_HEIGHT_PX } from './constants';

export type ThumbGeometry = Readonly<{ heightPx: number; offsetPx: number }>;

const clamp = (value: number, low: number, high: number): number =>
	Math.max(low, Math.min(high, value));

/**
 * Where the thumb stands for a scroller: its height is the visible share of the content,
 * its offset the scrolled share of what is left, never shorter than a grabbable minimum.
 * Null when there is nothing to scroll.
 */
export const thumbGeometry = (
	scrollTop: number,
	scrollHeight: number,
	clientHeight: number,
	minHeightPx = THUMB_MIN_HEIGHT_PX
): ThumbGeometry | null => {
	const hidden = scrollHeight - clientHeight;
	if (hidden <= 0 || clientHeight <= 0) return null;
	const heightPx = Math.max(
		minHeightPx,
		Math.min(clientHeight, (clientHeight * clientHeight) / scrollHeight)
	);
	const offsetPx = (Math.min(Math.max(scrollTop, 0), hidden) / hidden) * (clientHeight - heightPx);
	return { heightPx, offsetPx };
};

/**
 * The drag of the thumb as a scroll position: the pointer's travel since the grab, scaled from
 * the room the thumb has (the port less the thumb) to the content hidden, from the position at
 * the grab, clamped to the content. A scroller with nothing hidden stays where it is.
 */
export const dragScrollTop = (
	startScrollTop: number,
	deltaY: number,
	scrollHeight: number,
	clientHeight: number,
	thumbHeightPx: number
): number => {
	const hidden = scrollHeight - clientHeight;
	const room = clientHeight - thumbHeightPx;
	if (hidden <= 0 || room <= 0) return startScrollTop;
	return clamp(startScrollTop + (deltaY * hidden) / room, 0, hidden);
};

/**
 * A click on the rail pages: above the thumb one port up, below it one port down, on the thumb
 * nothing (that is a grab). Clamped to the content.
 */
export const pageScrollTop = (
	scrollTop: number,
	clickOffsetPx: number,
	thumb: ThumbGeometry,
	scrollHeight: number,
	clientHeight: number
): number => {
	const direction =
		clickOffsetPx < thumb.offsetPx ? -1 : clickOffsetPx > thumb.offsetPx + thumb.heightPx ? 1 : 0;
	return clamp(scrollTop + direction * clientHeight, 0, Math.max(0, scrollHeight - clientHeight));
};
