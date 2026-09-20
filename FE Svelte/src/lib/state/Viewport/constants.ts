import type { ViewportLimits } from './types';

export const DAY_MS = 86_400_000;

/**
 * The window never leaves 1700–2100: the far past reaches the oldest records a notebook may
 * hold (the demo lives in the 1880s); the widest window stays the 110 years it always was.
 */
export const DEFAULT_LIMITS: ViewportLimits = Object.freeze({
	minSpanMs: 1.5 * DAY_MS,
	maxSpanMs: Date.UTC(2100, 0, 1) - Date.UTC(1990, 0, 1),
	minStart: Date.UTC(1700, 0, 1),
	maxEnd: Date.UTC(2100, 0, 1)
});

/** One press of − / + or a keyboard step. */
export const ZOOM_STEP = 0.7;
/** Arrow keys move the window by this share of its span. */
export const PAN_STEP_RATIO = 0.1;
/** Presets put the centre at 70 % so most of the window is the past. */
export const PRESET_PAST_RATIO = 0.7;
/** While following, «сейчас» sits at three quarters of the width (DESIGN.md §6). */
export const FOLLOW_NOW_RATIO = 0.75;
/** Padding around a fitted range. */
export const FIT_PAD_RATIO = 0.08;
/** DP7: a revealed range longer than the window is fitted with this margin on each side. */
export const REVEAL_PAD_RATIO = 0.1;

export const INITIAL_PAST_DAYS = 200;
export const INITIAL_FUTURE_DAYS = 40;

/** Travel to a selection or a control target, and shorter wheel response. */
export const CAMERA_DURATION_MS = 420;
export const WHEEL_DURATION_MS = 140;
