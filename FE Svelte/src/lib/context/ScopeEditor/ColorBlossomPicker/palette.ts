import {
	hslToHex,
	type BlossomColorPickerColor,
	type BlossomColorPickerValue
} from '@dayflow/blossom-color-picker';
import {
	DEFAULT_CHROMA,
	DEFAULT_DEPTH,
	normalizeChroma,
	normalizeDepth,
	normalizeHue,
	scopeColour,
	type ScopeColour,
	type ScopeGround
} from '$lib/theme/scope-colour';
import { ARC_STOPS } from '$lib/ui/BlossomPopover/constants';
import { petalByBlossomHue } from '$lib/ui/BlossomPopover/decorate';
import { ringedPetals } from '$lib/ui/BlossomPopover/geometry';
import type { BlossomSource } from '$lib/ui/BlossomPopover/types';
import {
	FLOWER_PETALS,
	IDENTITY_LIGHTNESS,
	IDENTITY_SATURATION,
	IDENTITY_STEP,
	PETAL_COUNT,
	PETAL_HUES,
	PETAL_STEP
} from './constants';
import type { ScopePetal } from './types';

export { blossomGeometry } from '$lib/ui/BlossomPopover/geometry';

/** The hue of a petal: its place in its ring, on the 15° grid. */
export const petalHue = (index: number): number => PETAL_HUES[index % PETAL_COUNT];
/** The depth of a petal: its ring, 0 the innermost. */
export const petalDepth = (index: number): number => Math.floor(index / PETAL_COUNT);
/** The petal of a place on the grid at a depth. */
export const petalAt = (hueIndex: number, depth: number): number => depth * PETAL_COUNT + hueIndex;

/**
 * What the petals show on this ground at this saturation: `scopeColour` of each hue at each
 * depth, so the petal a user clicks shows exactly the colour the ribbon draws. Recomputed when
 * the theme or the saturation changes and painted over the library's petals by index.
 */
export const blossomPalette = (ground: ScopeGround, chroma: number | null): string[] =>
	Array.from({ length: FLOWER_PETALS }, (_, index) =>
		scopeColour(petalHue(index), chroma, ground, petalDepth(index))
	);

/**
 * The petals as the library knows them: 72 identities 5° apart (`IDENTITY_*`), in three rings
 * by depth. A Blossom `hue` maps back through `hsl.h`, unique across the palette (the test
 * proves it). The same in every theme, so the flower is built once per opening.
 */
export const blossomPetals = (): ScopePetal[] => {
	const hsl = Array.from({ length: FLOWER_PETALS }, (_, index) => ({
		h: index * IDENTITY_STEP,
		s: IDENTITY_SATURATION,
		l: IDENTITY_LIGHTNESS
	}));
	const hexes = hsl.map((colour) => hslToHex(colour.h, colour.s, colour.l));
	return ringedPetals(hexes, hsl, petalDepth).map((petal) => ({
		...petal,
		hue: petalHue(petal.index),
		depth: petalDepth(petal.index)
	}));
};

/**
 * The petal nearest a hue on the grid of `PETAL_STEP` at a depth; the top of the circle folds
 * onto the first of the ring.
 */
export const nearestPetal = (hue: number, depth: number | null = DEFAULT_DEPTH): number =>
	petalAt(
		Math.round((normalizeHue(hue) ?? 0) / PETAL_STEP) % PETAL_COUNT,
		normalizeDepth(depth) ?? DEFAULT_DEPTH
	);

/**
 * The controlled `value` the flower shows for the Scope's colour: the nearest petal as Blossom
 * knows it, the arc at the saturation (its 0–100 position is our chroma). Without a hue the
 * first petal keeps the library consistent; the skin paints the core neutral and marks no petal.
 */
export const blossomValue = (
	petals: readonly ScopePetal[],
	hue: number | null,
	chroma: number | null,
	depth: number | null = DEFAULT_DEPTH
): BlossomColorPickerValue => {
	const petal = petals[hue === null ? 0 : nearestPetal(hue, depth)];
	return {
		hue: petal.hsl.h,
		saturation: normalizeChroma(chroma) ?? DEFAULT_CHROMA,
		lightness: petal.hsl.l,
		originalSaturation: petal.hsl.s,
		alpha: 100,
		layer: petal.layer
	};
};

/**
 * A Blossom change in our model. The payload's `hue` is the petal's HSL hue (its identity),
 * `saturation` the arc's position; its `hex`/`hsl` are never used — `scopeColour` is the truth.
 * A petal sets the hue and the depth and keeps the saturation; the arc keeps both and sets the
 * saturation. The arc without a hue picks nothing, as the disabled range does; an unknown
 * petal picks nothing. `undefined` is «nothing to pick», distinct from `null` («без цвета»).
 */
export const readBlossomChange = (
	petals: readonly ScopePetal[],
	change: Pick<BlossomColorPickerColor, 'hue' | 'saturation'>,
	current: Readonly<{ hue: number | null; chroma: number | null; depth?: number | null }>,
	source: BlossomSource
): ScopeColour | undefined => {
	if (source === 'petal') {
		const petal = petalByBlossomHue(petals, change.hue) as ScopePetal | undefined;
		return petal === undefined
			? undefined
			: { hue: petal.hue, chroma: current.chroma, depth: petal.depth };
	}
	if (current.hue === null) return undefined;
	return {
		hue: current.hue,
		chroma: normalizeChroma(change.saturation),
		depth: normalizeDepth(current.depth) ?? DEFAULT_DEPTH
	};
};

/** The arc's gradient: the saturation 0–100 of the hue chosen at its depth on this ground; the border's grey without a hue. */
export const saturationArc = (
	hue: number | null,
	ground: ScopeGround,
	depth: number | null = DEFAULT_DEPTH
): string[] =>
	Array.from({ length: ARC_STOPS }, (_, k) =>
		hue === null
			? 'var(--cg-border-default)'
			: scopeColour(hue, (k * 100) / (ARC_STOPS - 1), ground, depth)
	);
