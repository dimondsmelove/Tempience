export const DAY_MS = 86_400_000;

/** Minimum row geometry; taller rows admit more tracks at a readable pitch. */
export const ROW_HEIGHT_MIN_PX = 52;
export const MAX_TRACKS = 5;
export const TRACK_PITCH_MIN_PX = 9;
export const TRACK_PITCH_PX = 20;
/** A mark never grows past this; one geometry at every row height (DESIGN.md §4). */
export const TRACK_HEIGHT_MAX_PX = 16;
export const TRACK_TOP_MIN_PX = 2;

/** Track height by how many tracks the row currently needs, at the minimum pitch. */
export const TRACK_HEIGHT_PX = Object.freeze({ 1: 16, 2: 11, 3: 7, 4: 7, 5: 7 });

export const MIN_POINT_WIDTH_PX = 2;
export const MAX_POINT_WIDTH_PX = 8;
export const MIN_INTERVAL_WIDTH_PX = 2;
export const TRACK_GAP_PX = 1;
