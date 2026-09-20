/**
 * Loop 005 stored a Scope colour as a slot of the theme, 1..12 on the Графит wheel:
 * 212° + (n − 1)·27.5°. R1 (owner 2026-09-19) replaced the slot with a free hue, so a row an
 * older build wrote is read as that hue, rounded to the degree, until its next colour save
 * writes `colorHue` and clears `colorSlot`. Nothing is rewritten on read.
 */
const LEGACY_WHEEL_START_DEG = 212;
const LEGACY_WHEEL_STEP_DEG = 27.5;
const LEGACY_SLOT_COUNT = 12;

/** The hue a loop-005 slot stood for, or `null` when the value is not a slot. */
export const legacySlotHue = (slot: unknown): number | null =>
	typeof slot === 'number' && Number.isInteger(slot) && slot >= 1 && slot <= LEGACY_SLOT_COUNT
		? Math.round(LEGACY_WHEEL_START_DEG + (slot - 1) * LEGACY_WHEEL_STEP_DEG) % 360
		: null;
