/** How long a row takes to glide to its new place: the rail's and the ribbon's lanes alike. */
export const ROW_MOVE_MS = 200;

/** The glide's easing as CSS writes it (the rail's Web Animation)… */
export const ROW_MOVE_EASING = 'cubic-bezier(0.2, 0, 0, 1)';
/** …and its control points, for the canvas that eases the same curve itself. */
export const ROW_MOVE_CURVE = [0.2, 0, 0, 1] as const;

/** A row that moves less than this does not glide. */
export const ROW_MOVE_MIN_PX = 1;
