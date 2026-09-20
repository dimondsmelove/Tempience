/** A press moves this far before it is a drag rather than a click (mock v6.2). */
export const DRAG_THRESHOLD_PX = 4;
/** The middle of a row, as a fraction of its height, is the merge zone; the rest inserts above or below (mock v6.2: 0.28–0.72). */
export const MERGE_ZONE_START = 0.28;
export const MERGE_ZONE_END = 0.72;
/** The dead zone at the merge/insert boundary: the previous target holds while the pointer stays this close to it. */
export const HYSTERESIS_PX = 2;
