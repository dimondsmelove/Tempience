import {
	hexToHsl,
	hslToHex,
	lightnessToSliderValue,
	parseColor,
	sliderValueToLightness,
	type BlossomColorPickerColor,
	type BlossomColorPickerValue
} from '@dayflow/blossom-color-picker';
import { ARC_STOPS } from '$lib/ui/BlossomPopover/constants';
import { petalByBlossomHue } from '$lib/ui/BlossomPopover/decorate';
import { ringPetals } from '$lib/ui/BlossomPopover/geometry';
import type { BlossomSource, Hsl, Petal } from '$lib/ui/BlossomPopover/types';
import {
	GREY_SATURATION,
	LIGHTNESS_MAX,
	LIGHTNESS_MIN,
	THEME_PETAL_COUNT,
	THEME_PETAL_LIGHTNESS,
	THEME_PETAL_SATURATION,
	THEME_PETAL_STEP
} from './constants';

/** The hue of a theme petal by its index. */
export const themePetalHue = (index: number): number => index * THEME_PETAL_STEP;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FUNCTIONAL = /^(?:rgb|hsl)a?\(/i;

/** A `#rgb` written long, so the library's hex reader gets six digits. */
const longHex = (value: string): string =>
	value.length === 4 ? `#${[...value.slice(1)].map((digit) => digit + digit).join('')}` : value;

/**
 * A theme colour as the flower reads it, or `null` when the text is not a colour yet (typed
 * halfway): `#rgb`, `#rrggbb`, `rgb()` and `hsl()` — what the presets and the hex field hold.
 */
export const parseThemeColour = (value: string): Hsl | null => {
	const text = value.trim();
	if (HEX.test(text)) return hexToHsl(longHex(text));
	if (FUNCTIONAL.test(text)) return parseColor(text);
	return null;
};

/**
 * The palette the library is handed and the petals show, one and the same here: twenty-four
 * hues at `THEME_PETAL_SATURATION` / `THEME_PETAL_LIGHTNESS`. Fixed, so the library never
 * rebuilds the flower while the arc is dragged.
 */
export const themePalette = (): string[] =>
	Array.from({ length: THEME_PETAL_COUNT }, (_, index) =>
		hslToHex(themePetalHue(index), THEME_PETAL_SATURATION, THEME_PETAL_LIGHTNESS)
	);

export const themePetals = (): Petal[] => {
	const hexes = themePalette();
	return ringPetals(hexes, hexes.map(hexToHsl));
};

/** The petal nearest a colour's hue; a grey marks none. */
export const selectedThemePetal = (colour: Hsl | null): number | null =>
	colour === null || colour.s < GREY_SATURATION
		? null
		: Math.round((((colour.h % 360) + 360) % 360) / THEME_PETAL_STEP) % THEME_PETAL_COUNT;

const clampLightness = (l: number): number =>
	Math.max(LIGHTNESS_MIN, Math.min(LIGHTNESS_MAX, Math.round(l)));

/**
 * The controlled `value`: the nearest petal as Blossom knows it (the first one for a grey or
 * no colour), the arc at the colour's lightness on the library's ramp.
 */
export const themeValue = (
	petals: readonly Petal[],
	colour: Hsl | null
): BlossomColorPickerValue => {
	const petal = petals[selectedThemePetal(colour) ?? 0];
	const lightness = clampLightness(colour?.l ?? THEME_PETAL_LIGHTNESS);
	return {
		hue: petal.hsl.h,
		saturation: lightnessToSliderValue(lightness),
		lightness,
		originalSaturation: colour?.s ?? THEME_PETAL_SATURATION,
		alpha: 100,
		layer: petal.layer
	};
};

/**
 * A Blossom change as a theme hex. A petal gives the colour its hue at the petal saturation and
 * keeps the lightness; the arc keeps the hue and the saturation (a grey stays grey) and sets the
 * lightness from its position on the ramp — Blossom's own maths, `hslToHex` and
 * `sliderValueToLightness`. `undefined` is «nothing to pick»: an unknown petal, or the arc with
 * nothing to lighten.
 */
export const readThemeChange = (
	petals: readonly Petal[],
	change: Pick<BlossomColorPickerColor, 'hue' | 'saturation'>,
	current: Hsl | null,
	source: BlossomSource
): string | undefined => {
	const lightness = clampLightness(current?.l ?? THEME_PETAL_LIGHTNESS);
	if (source === 'petal') {
		const petal = petalByBlossomHue(petals, change.hue);
		return petal === undefined
			? undefined
			: hslToHex(themePetalHue(petal.index), THEME_PETAL_SATURATION, lightness);
	}
	if (current === null) return undefined;
	return hslToHex(current.h, current.s, Math.round(sliderValueToLightness(change.saturation)));
};

/** The arc's gradient: the colour's hue and saturation from white to its darkest on the ramp; grey for no colour. */
export const lightnessArc = (colour: Hsl | null): string[] =>
	Array.from({ length: ARC_STOPS }, (_, k) =>
		colour === null
			? 'var(--cg-border-default)'
			: hslToHex(colour.h, colour.s, sliderValueToLightness((k * 100) / (ARC_STOPS - 1)))
	);
