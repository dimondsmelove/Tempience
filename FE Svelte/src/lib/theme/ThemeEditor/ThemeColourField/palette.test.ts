import { hexToHsl, hslToHex, sliderValueToLightness } from '@dayflow/blossom-color-picker';
import { describe, expect, it } from 'vitest';
import { ARC_STOPS } from '$lib/ui/BlossomPopover/constants';
import {
	GREY_SATURATION,
	THEME_PETAL_COUNT,
	THEME_PETAL_LIGHTNESS,
	THEME_PETAL_SATURATION
} from './constants';
import {
	lightnessArc,
	parseThemeColour,
	readThemeChange,
	selectedThemePetal,
	themePalette,
	themePetalHue,
	themePetals,
	themeValue
} from './palette';

const petals = themePetals();

describe('parseThemeColour', () => {
	it('reads the hex the presets and the field hold, long or short, and the functional forms', () => {
		expect(parseThemeColour('#7FD9C6')).toEqual(hexToHsl('#7fd9c6'));
		expect(parseThemeColour(' #fff ')).toEqual({ h: 0, s: 0, l: 100 });
		expect(parseThemeColour('rgb(255, 0, 0)')).toEqual({ h: 0, s: 100, l: 50 });
		expect(parseThemeColour('hsl(210, 40%, 30%)')).toEqual({ h: 210, s: 40, l: 30 });
	});
	it('is nothing for text that is not a colour yet', () => {
		expect(parseThemeColour('#7FD9C')).toBeNull();
		expect(parseThemeColour('')).toBeNull();
		expect(parseThemeColour('teal')).toBeNull();
	});
});

describe('the theme palette', () => {
	it('is twenty-four hues 15° apart at one saturation and lightness, each a distinct HSL hue to the library', () => {
		expect(THEME_PETAL_COUNT).toBe(24);
		expect(themePalette()).toHaveLength(24);
		expect(themePalette()[14]).toBe(hslToHex(210, THEME_PETAL_SATURATION, THEME_PETAL_LIGHTNESS));
		expect(themePetalHue(14)).toBe(210);
		expect(new Set(petals.map((petal) => petal.hsl.h)).size).toBe(24);
		expect(petals.map((petal) => petal.hex)).toEqual(themePalette());
	});
	it('marks the petal nearest a colour’s hue and none for a grey or no colour', () => {
		expect(selectedThemePetal({ h: 212, s: 60, l: 50 })).toBe(14);
		expect(selectedThemePetal({ h: 353, s: 60, l: 50 })).toBe(0);
		expect(selectedThemePetal({ h: 120, s: GREY_SATURATION - 1, l: 50 })).toBeNull();
		expect(selectedThemePetal({ h: 0, s: 0, l: 8 })).toBeNull();
		expect(selectedThemePetal(null)).toBeNull();
	});
});

describe('themeValue', () => {
	it('shows the nearest petal with the arc at the colour’s lightness on the ramp, clamped to its reach', () => {
		const teal = themeValue(petals, { h: 168, s: 54, l: 67 });
		expect(teal).toMatchObject({
			hue: petals[11].hsl.h,
			lightness: 67,
			originalSaturation: 54,
			alpha: 100
		});
		expect(sliderValueToLightness(teal.saturation)).toBeCloseTo(67, 5);
		// A grey on the first petal (unmarked by the skin), its lightness no darker than the ramp goes.
		expect(themeValue(petals, { h: 0, s: 0, l: 8 })).toMatchObject({
			hue: petals[0].hsl.h,
			lightness: 20,
			saturation: 100
		});
		expect(themeValue(petals, null)).toMatchObject({ lightness: THEME_PETAL_LIGHTNESS });
	});
});

describe('readThemeChange', () => {
	it('gives the colour the petal’s hue at the petal saturation and keeps the lightness', () => {
		expect(
			readThemeChange(
				petals,
				{ hue: petals[14].hsl.h, saturation: 0 },
				{ h: 30, s: 80, l: 40 },
				'petal'
			)
		).toBe(hslToHex(210, THEME_PETAL_SATURATION, 40));
		// A grey gains a hue at its own lightness, clamped to the ramp; no colour yet takes the petal's own lightness.
		expect(
			readThemeChange(
				petals,
				{ hue: petals[6].hsl.h, saturation: 0 },
				{ h: 0, s: 0, l: 8 },
				'petal'
			)
		).toBe(hslToHex(90, THEME_PETAL_SATURATION, 20));
		expect(readThemeChange(petals, { hue: petals[6].hsl.h, saturation: 0 }, null, 'petal')).toBe(
			hslToHex(90, THEME_PETAL_SATURATION, THEME_PETAL_LIGHTNESS)
		);
		expect(
			readThemeChange(petals, { hue: 999, saturation: 0 }, { h: 30, s: 80, l: 40 }, 'petal')
		).toBeUndefined();
	});
	it('keeps the hue and the saturation on the arc and sets the lightness from the ramp — a grey stays grey', () => {
		expect(
			readThemeChange(petals, { hue: 0, saturation: 50 }, { h: 168, s: 54, l: 67 }, 'arc')
		).toBe(hslToHex(168, 54, 60));
		expect(readThemeChange(petals, { hue: 0, saturation: 100 }, { h: 0, s: 0, l: 90 }, 'arc')).toBe(
			hslToHex(0, 0, 20)
		);
		expect(readThemeChange(petals, { hue: 0, saturation: 0 }, { h: 0, s: 0, l: 90 }, 'arc')).toBe(
			'#ffffff'
		);
		expect(readThemeChange(petals, { hue: 0, saturation: 50 }, null, 'arc')).toBeUndefined();
	});
});

describe('lightnessArc', () => {
	it('runs the colour’s hue and saturation from white to the darkest the ramp reaches, grey for no colour', () => {
		const arc = lightnessArc({ h: 168, s: 54, l: 67 });
		expect(arc).toHaveLength(ARC_STOPS);
		expect(arc[0]).toBe('#ffffff');
		expect(arc[5]).toBe(hslToHex(168, 54, 60));
		expect(arc.at(-1)).toBe(hslToHex(168, 54, 20));
		expect(new Set(lightnessArc(null))).toEqual(new Set(['var(--cg-border-default)']));
	});
});
