export const NO_COLOUR_KEY = 'scope.colourNone' as const;
export const HUE_KEY = 'scope.colourHue' as const;
export const CHROMA_KEY = 'scope.colourChroma' as const;
export const QUICK_KEY = 'scope.colourQuick' as const;
/** The hue bar spans the circle in whole degrees; 360 folds onto 0. */
export const HUE_MIN = 0;
export const HUE_MAX = 359;
/** The saturation bar runs the user's 0–100. */
export const CHROMA_MIN_PERCENT = 0;
export const CHROMA_MAX_PERCENT = 100;
/** One gradient stop every 15° (25 stops) and every 10 % (11 stops) draw the bars without visible banding. */
export const BAR_STOP_DEG = 15;
export const CHROMA_STOP_PERCENT = 10;
