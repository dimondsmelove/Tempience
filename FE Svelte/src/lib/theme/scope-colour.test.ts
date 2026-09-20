import { describe, expect, it } from 'vitest';
import { baseline, builtinThemes } from './catalog';
import { colorFields } from './constants';
import { parseTheme } from './normalize';
import {
	CHROMA_MAX,
	CHROMA_MIN,
	DEPTH_STEPS,
	QUICK_HUES,
	STOCK_BASE,
	STOCK_CANVAS,
	chromaCeiling,
	chromaOf,
	colourLightness,
	depthLightness,
	gamutChroma,
	normalizeChroma,
	normalizeDepth,
	normalizeHue,
	oklchToHex,
	scopeBase,
	scopeBaseLightness,
	scopeColour,
	scopeColourKey,
	scopeColourOf,
	scopeColourPair
} from './scope-colour';

const HEX = /^#[\da-f]{6}$/;
const channels = (hex: string): number[] =>
	[1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
/** OKLCH hue and chroma of a hex colour, to check what the rule kept. */
const oklch = (hex: string): { hue: number; chroma: number } => {
	const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
	const [r, g, b] = channels(hex).map((c) => toLinear(c / 255));
	const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
	const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
	return { hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360, chroma: Math.hypot(a, bb) };
};
const angle = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

describe('scopeColour', () => {
	it('fixes the lightness of depth 0 per stock canvas — Графит L 0.80, Стоун L 0.55 — and the chroma range 0.04–0.18 (R1, owner 2026-09-19)', () => {
		expect(STOCK_BASE.dark.lightness[0]).toBe(0.8);
		expect(STOCK_BASE.light.lightness[0]).toBe(0.55);
		expect([CHROMA_MIN, CHROMA_MAX]).toEqual([0.04, 0.18]);
		// Green at L 0.80 holds the whole range: saturation 100 is C 0.18, 0 is C 0.04, 50 halfway.
		expect(chromaCeiling(120, 'dark')).toBe(0.18);
		expect(chromaOf(120, 100, 'dark')).toBe(0.18);
		expect(chromaOf(120, 0, 'dark')).toBe(0.04);
		expect(chromaOf(120, 50, 'dark')).toBeCloseTo(0.11, 10);
		expect(scopeColour(120, 100, 'dark')).toBe(oklchToHex(0.8, 0.18, 120));
		expect(scopeColour(120, 0, 'dark')).toBe(oklchToHex(0.8, 0.04, 120));
		expect(scopeColour(0, 100, 'light')).toBe(oklchToHex(0.55, 0.18, 0));
		// The saturation left unsaid is the default, 100.
		expect(scopeColour(120, null, 'dark')).toBe(scopeColour(120, 100, 'dark'));
	});
	it('pins the three depths of the stock canvases — Графит 0.80 / 0.68 / 0.56, Стоун 0.55 / 0.45 / 0.36 (owner 2026-09-19, C6)', () => {
		expect(STOCK_CANVAS).toEqual({ dark: '#0F1418', light: '#E7E5DF' });
		expect(scopeBase('#0F1418')).toEqual({ mode: 'dark', lightness: [0.8, 0.68, 0.56] });
		expect(scopeBase('#E7E5DF')).toEqual({ mode: 'light', lightness: [0.55, 0.45, 0.36] });
		expect(STOCK_BASE).toEqual({ dark: scopeBase('#0F1418'), light: scopeBase('#E7E5DF') });
		expect(DEPTH_STEPS).toEqual({ dark: [0, 0.12, 0.24], light: [0, 0.1, 0.19] });
		// A bare mode names the stock base: the 3-argument calls of R1 stay valid, depth 0.
		for (const mode of ['dark', 'light'] as const)
			for (const depth of [0, 1, 2]) {
				expect(depthLightness(mode, depth)).toBe(STOCK_BASE[mode].lightness[depth]);
				expect(scopeColour(120, 100, mode, depth)).toBe(
					scopeColour(120, 100, STOCK_BASE[mode], depth)
				);
			}
		expect(scopeColour(120, 100, 'dark')).toBe(scopeColour(120, 100, 'dark', 0));
		expect(scopeColour(120, 100, 'dark', null)).toBe(scopeColour(120, 100, 'dark', 0));
	});
	it('derives the base from the canvas at a fixed distance: a pale canvas gets deeper marks than Стоун, a near-white one Стоун’s, a canvas near black lighter ones than Графит', () => {
		expect(colourLightness('#0F1418')).toBeCloseTo(0.188, 3);
		expect(colourLightness('#E7E5DF')).toBeCloseTo(0.922, 3);
		expect(scopeBaseLightness(0.188)).toBe(0.8);
		expect(scopeBaseLightness(0.922)).toBe(0.55);
		// A pale paper canvas (L 0.87) sits closer to the marks: the base drops to 0.50.
		expect(scopeBase('#D9D3C7')).toEqual({ mode: 'light', lightness: [0.5, 0.4, 0.31] });
		expect(scopeBase('#D9D3C7').lightness[0]).toBeLessThan(STOCK_BASE.light.lightness[0]);
		// A canvas lighter than Стоун never pales the marks: Violet Bloom's near white, a pale
		// lavender and white itself keep Стоун's table exactly (primary review 2026-09-19).
		expect(scopeBase('#fdfdfd')).toEqual(STOCK_BASE.light);
		expect(scopeBase('#F2E8FF')).toEqual({ mode: 'light', lightness: [0.55, 0.45, 0.36] });
		expect(scopeBase('#FFFFFF')).toEqual(STOCK_BASE.light);
		// The clamps: near black lifts to 0.61, a mid grey meets a bound on either side.
		expect(scopeBase('#000000')).toEqual({ mode: 'dark', lightness: [0.61, 0.49, 0.37] });
		expect(scopeBase('#555555').lightness[0]).toBe(0.85);
		expect(scopeBase('#999999').lightness[0]).toBe(0.4);
		// Every form the theme editor accepts reads; anything else is the stock base of the fallback.
		expect(scopeBase('rgb(15, 20, 24)')).toEqual(STOCK_BASE.dark);
		expect(scopeBase('#0F1418FF')).toEqual(STOCK_BASE.dark);
		expect(scopeBase('oklch(0.9218 0.006 95)')).toEqual(STOCK_BASE.light);
		expect(scopeBase('hsl(200, 23%, 8%)').lightness[0]).toBe(0.81);
		expect(scopeBase('teal')).toEqual(STOCK_BASE.dark);
		expect(scopeBase('teal', 'light')).toEqual(STOCK_BASE.light);
		// On a paler ground the same pair is a darker colour: the memo key is the lightness, not the mode.
		expect(scopeColour(210, 60, scopeBase('#D9D3C7'))).not.toBe(scopeColour(210, 60, 'light'));
		expect(scopeColour(210, 60, scopeBase('#D9D3C7'))).toBe(
			oklchToHex(0.5, chromaOf(210, 60, scopeBase('#D9D3C7')), 210)
		);
		expect(scopeColour(210, 60, scopeBase('rgb(15, 20, 24)'))).toBe(scopeColour(210, 60, 'dark'));
	});
	it('computes the chroma ceiling at the depth’s lightness: a step deeper, a red is a real red', () => {
		// At L 0.80 a red stops near C 0.11 (salmon); at L 0.68 and 0.56 it holds the full 0.18.
		expect(chromaCeiling(25, 'dark', 0)).toBeLessThan(0.12);
		expect(chromaCeiling(25, 'dark', 1)).toBe(0.18);
		expect(chromaCeiling(25, 'dark', 2)).toBe(0.18);
		// Blue at L 0.80 stops near 0.10, at 0.68 near 0.17, at 0.56 takes the whole range.
		expect(chromaCeiling(263, 'dark', 1)).toBeGreaterThan(chromaCeiling(263, 'dark', 0));
		expect(chromaCeiling(263, 'dark', 2)).toBe(0.18);
		const deepRed = channels(scopeColour(25, 100, 'dark', 2));
		expect(deepRed[0]).toBeGreaterThan(150);
		expect(deepRed[0]).toBeGreaterThan(2 * deepRed[1]);
		expect(deepRed[1]).toBeLessThan(90);
		expect(deepRed[2]).toBeLessThan(90);
		// Each depth is its own colour, darker than the one above, still its hue.
		for (const mode of ['dark', 'light'] as const)
			for (let hue = 0; hue < 360; hue += 45) {
				const sums = [0, 1, 2].map((depth) =>
					channels(scopeColour(hue, 100, mode, depth)).reduce((a, b) => a + b, 0)
				);
				expect(sums[0], `${mode} ${hue}`).toBeGreaterThan(sums[1]);
				expect(sums[1], `${mode} ${hue}`).toBeGreaterThan(sums[2]);
				for (const depth of [1, 2])
					expect(angle(oklch(scopeColour(hue, 100, mode, depth)).hue, hue)).toBeLessThan(2.5);
			}
		expect(scopeColour(25, 100, 'dark', 2)).toBe(oklchToHex(0.56, 0.18, 25));
	});
	it('is one rule for every hue, saturation and mode: a hex colour, lighter in the dark mode than in the light', () => {
		const sum = (hex: string) => channels(hex).reduce((a, b) => a + b, 0);
		for (let hue = 0; hue < 360; hue += 7)
			for (const chroma of [0, 50, 100]) {
				const dark = scopeColour(hue, chroma, 'dark');
				const light = scopeColour(hue, chroma, 'light');
				expect(dark).toMatch(HEX);
				expect(light).toMatch(HEX);
				expect(sum(dark), `hue ${hue} chroma ${chroma}`).toBeGreaterThan(sum(light));
			}
	});
	it('runs saturation from a pastel to the vivid end without leaving the hue', () => {
		for (const [hue, mode] of [
			[30, 'dark'],
			[210, 'dark'],
			[90, 'light'],
			[300, 'light']
		] as const) {
			const pastel = oklch(scopeColour(hue, 0, mode));
			const mid = oklch(scopeColour(hue, 50, mode));
			const vivid = oklch(scopeColour(hue, 100, mode));
			expect(pastel.chroma, `${mode} ${hue}`).toBeCloseTo(CHROMA_MIN, 2);
			expect(mid.chroma).toBeGreaterThan(pastel.chroma);
			expect(vivid.chroma).toBeGreaterThan(mid.chroma);
			for (const colour of [pastel, mid, vivid])
				expect(angle(colour.hue, hue), `${mode} ${hue}`).toBeLessThan(2.5);
		}
	});
	it('meets the sRGB gamut at each hue’s own ceiling: blue at L 0.80, yellow and teal at L 0.55', () => {
		// Blue at L 0.80 cannot hold C 0.18 in sRGB; nor can yellow or teal at L 0.55.
		expect(chromaCeiling(263, 'dark')).toBeLessThan(0.11);
		expect(chromaCeiling(263, 'dark')).toBeGreaterThan(0.09);
		expect(chromaCeiling(87, 'light')).toBeLessThan(0.12);
		expect(chromaCeiling(199, 'light')).toBeLessThan(0.1);
		expect(chromaCeiling(199, 'light')).toBeGreaterThan(0.08);
		// Yellows and greens at L 0.80 hold more: 90° stops near 0.16, 120°–150° take the full 0.18.
		expect(chromaCeiling(90, 'dark')).toBeGreaterThan(0.15);
		expect(chromaCeiling(90, 'dark')).toBeLessThan(0.18);
		expect(chromaCeiling(150, 'dark')).toBe(0.18);
		// At the ceiling the colour is in gamut, still clearly coloured, and still its hue.
		for (const [hue, mode] of [
			[263, 'dark'],
			[87, 'light'],
			[199, 'light']
		] as const) {
			const colour = scopeColour(hue, 100, mode);
			const rgb = channels(colour);
			expect(Math.max(...rgb) - Math.min(...rgb), `${mode} ${hue}`).toBeGreaterThan(60);
			expect(angle(oklch(colour).hue, hue), `${mode} ${hue}`).toBeLessThan(2.5);
		}
		expect(gamutChroma(0.8, 0.18, 263)).toBe(chromaCeiling(263, 'dark'));
	});
	it('reads a hue as an integer degree on the circle, a saturation as an integer 0–100, and anything else as unsaid', () => {
		expect(normalizeHue(267)).toBe(267);
		expect(normalizeHue(239.5)).toBe(240);
		expect(normalizeHue(360)).toBe(0);
		expect(normalizeHue(-30)).toBe(330);
		expect(normalizeHue(null)).toBeNull();
		expect(normalizeHue('12')).toBeNull();
		expect(normalizeHue(Number.NaN)).toBeNull();
		expect(normalizeChroma(50)).toBe(50);
		expect(normalizeChroma(49.6)).toBe(50);
		expect(normalizeChroma(140)).toBe(100);
		expect(normalizeChroma(-3)).toBe(0);
		expect(normalizeChroma(null)).toBeNull();
		expect(normalizeChroma('50')).toBeNull();
		expect(normalizeDepth(2)).toBe(2);
		expect(normalizeDepth(1.4)).toBe(1);
		expect(normalizeDepth(0)).toBe(0);
		expect(normalizeDepth(3)).toBeNull();
		expect(normalizeDepth(-1)).toBeNull();
		expect(normalizeDepth(null)).toBeNull();
		expect(normalizeDepth('1')).toBeNull();
		expect(scopeColour(90, 100, 'dark', 7)).toBe(scopeColour(90, 100, 'dark', 0));
		expect(scopeColour(360, 100, 'dark')).toBe(scopeColour(0, 100, 'dark'));
		expect(scopeColour(90, 250, 'dark')).toBe(scopeColour(90, 100, 'dark'));
	});
	it('names the colour of a Scope — an absent depth is 0 — and resolves an absent hue to no colour', () => {
		expect(scopeColourPair({ colorHue: 267, colorChroma: 40 })).toEqual({
			hue: 267,
			chroma: 40,
			depth: 0
		});
		expect(scopeColourPair({ colorHue: 267, colorChroma: null, colorDepth: null })).toEqual({
			hue: 267,
			chroma: null,
			depth: 0
		});
		expect(scopeColourPair({ colorHue: 267, colorChroma: null, colorDepth: 2 })).toEqual({
			hue: 267,
			chroma: null,
			depth: 2
		});
		expect(scopeColourPair({ colorHue: null, colorChroma: 40, colorDepth: 2 })).toBeNull();
		expect(scopeColourOf(null, 'dark')).toBeNull();
		expect(scopeColourOf(undefined, 'light')).toBeNull();
		expect(scopeColourOf({ hue: 90, chroma: 30 }, 'light')).toBe(scopeColour(90, 30, 'light'));
		expect(scopeColourOf({ hue: 90, chroma: 30, depth: 2 }, 'light')).toBe(
			scopeColour(90, 30, 'light', 2)
		);
		expect(scopeColourKey({ hue: 90, chroma: null })).toBe(
			scopeColourKey({ hue: 90, chroma: 100, depth: 0 })
		);
		expect(scopeColourKey({ hue: 90, chroma: 30 })).not.toBe(
			scopeColourKey({ hue: 90, chroma: 100 })
		);
		expect(scopeColourKey({ hue: 90, chroma: 30, depth: 1 })).not.toBe(
			scopeColourKey({ hue: 90, chroma: 30 })
		);
	});
	it('offers twelve quick picks 30° apart in the order of the hue bar', () => {
		expect(QUICK_HUES).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
	});
});

describe('themes without slot tables', () => {
	it('carries no Scope slot fields: the theme decides the mode, nothing else about a Scope colour', () => {
		expect(Object.keys(colorFields).some((key) => /^scopeSlot/.test(key))).toBe(false);
		for (const theme of builtinThemes)
			for (const mode of ['light', 'dark'] as const)
				expect(Object.keys(theme.colors[mode]).some((key) => /^scopeSlot/.test(key))).toBe(false);
	});
	it('still loads a theme saved with the slot keys of loop 005, dropping them', () => {
		const stored = structuredClone(baseline) as { colors: Record<string, Record<string, unknown>> };
		for (const mode of ['light', 'dark'])
			for (let slot = 1; slot <= 12; slot++) stored.colors[mode][`scopeSlot${slot}`] = '#123456';
		const parsed = parseTheme({ ...stored, id: 'custom:old', name: 'Старая' });
		expect(parsed).not.toBeNull();
		expect(parsed!.colors.dark).toEqual(baseline.colors.dark);
		expect(Object.keys(parsed!.colors.light)).toEqual(Object.keys(colorFields));
	});
});
