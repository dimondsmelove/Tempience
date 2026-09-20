import { DEPTH_COUNT } from '$lib/theme/scope-colour';

export { CHROMA_KEY, HUE_KEY, NO_COLOUR_KEY, QUICK_KEY } from '../ColorHuePicker/constants';
export const FINE_KEY = 'scope.colourFine' as const;
export const READOUT_KEY = 'scope.colourReadout' as const;
/** A petal's name for readers: its hue and its depth — «Оттенок N° · глубина D». */
export const PETAL_KEY = 'scope.colourPetal' as const;
/** The Context dot's names: «Цвет Scope: …» with a colour, «Задать цвет Scope» without (C6, D). */
export const DOT_KEY = 'scope.colourOf' as const;
export const DOT_SET_KEY = 'scope.colourSet' as const;
/** The flower's own test id and the prefix of its petals', as the specs name them. */
export const FLOWER_TEST_ID = 'scope-blossom' as const;
/**
 * The exact controls — the readout «Оттенок N° · глубина D · насыщенность M» and, under «Точно»,
 * the two native ranges for any exact degree — are kept in the code but off the screen: the
 * owner wants the flower alone in the popover (review 2026-09-19, pack 3, P1). The colour's
 * words stay the swatch's name for readers. Flip to `true` to show them again under the flower.
 */
export const SHOW_EXACT_CONTROLS = false;
/**
 * Petals: twenty-four hues 15° apart in each of three rings, one ring per depth (C6) — the
 * safe palette of the theme at the saturation chosen, every petal `scopeColour` of its hue at
 * its depth. The light ring (depth 0) is the innermost, the deep ring the outermost, and the
 * same hue sits on one spoke through all three.
 */
export const PETAL_COUNT = 24;
export const PETAL_STEP = 360 / PETAL_COUNT;
export const PETAL_HUES: readonly number[] = Array.from(
	{ length: PETAL_COUNT },
	(_, i) => i * PETAL_STEP
);
export const RING_COUNT = DEPTH_COUNT;
export const FLOWER_PETALS = PETAL_COUNT * RING_COUNT;
/**
 * The identity of a petal to the library — an HSL colour it never draws (the skin paints what
 * a petal shows): a distinct hue per petal, 5° apart over the 72, at one saturation and
 * lightness. Stable whatever the theme or the saturation, so the library never rebuilds the
 * flower while the arc is dragged or the theme switches.
 */
export const IDENTITY_STEP = 360 / FLOWER_PETALS;
export const IDENTITY_SATURATION = 70;
export const IDENTITY_LIGHTNESS = 55;
