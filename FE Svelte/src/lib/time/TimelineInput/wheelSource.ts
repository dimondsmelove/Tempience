import { MOUSE_WHEEL_MIN_DELTA, TRACKPAD_GESTURE_GAP_MS } from './constants';

export type WheelSource = 'mouse' | 'trackpad';
type WheelLike = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode'>;

/**
 * Tells a mouse notch from a trackpad swipe, event by event, remembering the swipe: the
 * first events of a swipe are small or two-dimensional, the later ones may be as large as
 * a notch, and they follow within a short gap. A notch out of the blue, whole or
 * fractional, is the mouse. Line and page deltas are always the mouse.
 */
export class WheelSourceReader {
	#swipeUntil = 0;

	read(event: WheelLike, now: number): WheelSource {
		if (event.deltaMode !== 0) return 'mouse';
		const swipeLike = event.deltaX !== 0 || Math.abs(event.deltaY) < MOUSE_WHEEL_MIN_DELTA;
		if (swipeLike || now < this.#swipeUntil) {
			this.#swipeUntil = now + TRACKPAD_GESTURE_GAP_MS;
			return 'trackpad';
		}
		return 'mouse';
	}
}
