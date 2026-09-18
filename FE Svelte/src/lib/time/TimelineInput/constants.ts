/** d3-zoom scale extent is effectively unbounded; the viewport clamps the span itself. */
export const SCALE_EXTENT: [number, number] = [1e-6, 1e6];

/** Shift + wheel pans by this share of the span per 100 px of wheel delta. */
export const SHIFT_WHEEL_PAN_RATIO = 0.15;
