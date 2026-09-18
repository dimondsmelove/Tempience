/** d3-zoom scale extent is effectively unbounded; the viewport clamps the span itself. */
export const SCALE_EXTENT: [number, number] = [1e-6, 1e6];

/** Shift + wheel pans by this share of the span per 100 px of wheel delta. */
export const SHIFT_WHEEL_PAN_RATIO = 0.15;

/**
 * Wheel delta to zoom, as d3-zoom reads it: the span scales by 2^(delta × unit), the unit
 * by the event's delta mode (pixels, lines, pages). A pinch, which arrives as a wheel with
 * Ctrl held, is read ten times stronger, like d3 does.
 */
export const WHEEL_ZOOM_UNIT: readonly [number, number, number] = [0.002, 0.05, 1];
export const PINCH_ZOOM_GAIN = 10;

/**
 * A mouse wheel notch versus a trackpad swipe. A notch is one event of at least this many
 * pixels (53⅓ on Linux, 100 or 120 elsewhere) with no horizontal part, or in lines and
 * pages; a swipe starts with small, two-dimensional deltas and grows as the fingers speed
 * up. Once a swipe has started, its events keep coming within this gap, and every one of
 * them is a swipe, however large.
 */
export const MOUSE_WHEEL_MIN_DELTA = 40;
export const TRACKPAD_GESTURE_GAP_MS = 200;
