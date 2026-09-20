/**
 * The theme flower runs on Blossom's own HSL model (owner review 2026-09-19, pack 3, P2): a
 * theme colour is a full colour, any lightness, so the petals are a fixed palette and the arc
 * is the library's lightness ramp. Twenty-four hues 15° apart at one saturation and lightness —
 * fixed, not the field's own lightness: most theme roles are near-greys, at whose lightness the
 * petals would all read as black or white.
 */
export const THEME_PETAL_COUNT = 24;
export const THEME_PETAL_STEP = 360 / THEME_PETAL_COUNT;
export const THEME_PETAL_SATURATION = 70;
export const THEME_PETAL_LIGHTNESS = 55;
/** Below this HSL saturation a colour is a grey: no petal is marked, the arc lightens the grey. */
export const GREY_SATURATION = 8;
/** The arc's reach in lightness: Blossom's ramp runs 100 (white) at 0 to 20 at 100. */
export const LIGHTNESS_MIN = 20;
export const LIGHTNESS_MAX = 100;
export const HUE_KEY = 'theme.hue' as const;
export const PALETTE_KEY = 'theme.palettePicker' as const;
