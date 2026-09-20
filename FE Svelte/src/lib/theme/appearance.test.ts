import { describe, expect, it } from 'vitest';
import { baseline, builtinThemes } from './catalog';
import { defaultDevice } from './constants';
import { parseDevice, parseTheme } from './normalize';
import { panelWidths, resolveAppearance } from './resolve-appearance';

describe('appearance contract', () => {
	it('accepts every pinned preset in both modes with unique identity', () => {
		expect(builtinThemes).toHaveLength(43);
		expect(new Set(builtinThemes.map((theme) => theme.id)).size).toBe(43);
		for (const theme of builtinThemes) expect(parseTheme(theme), theme.id).not.toBeNull();
	});
	it('keeps preset raised surfaces at or above the panel in both modes', () => {
		const luminance = (hex: string) => {
			const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		for (const theme of builtinThemes)
			for (const mode of ['light', 'dark'] as const) {
				const { surface, raised } = theme.colors[mode];
				if (!/^#[\da-f]{6}$/i.test(surface)) continue;
				expect(luminance(raised), theme.id + ' ' + mode).toBeGreaterThanOrEqual(luminance(surface));
			}
	});
	it('rejects executable styles, missing palettes, incompatible versions and invalid metrics', () => {
		const edit = () => structuredClone(baseline);
		const unsafe = edit();
		unsafe.colors.dark.canvas = 'url(https://example.com)';
		expect(parseTheme(unsafe)).toBeNull();
		for (const value of [
			'rgb(1)',
			'rgb(1,2 3)',
			'hsl(20 30 40)',
			'oklch(1, 0, 0)',
			'rgb(.. 2 3)'
		]) {
			unsafe.colors.dark.canvas = value;
			expect(parseTheme(unsafe), value).toBeNull();
		}
		for (const value of [
			'#abcd',
			'rgb(1 2 3 / 50%)',
			'rgba(1, 2, 3, .5)',
			'hsl(20deg 30% 40%)',
			'oklch(.6 .2 120)'
		]) {
			unsafe.colors.dark.canvas = value;
			expect(parseTheme(unsafe), value).not.toBeNull();
		}
		const missing = edit();
		delete (missing.colors as Partial<typeof missing.colors>).light;
		expect(parseTheme(missing)).toBeNull();
		expect(parseTheme({ ...baseline, formatVersion: 2 })).toBeNull();
		expect(
			parseTheme({ ...baseline, metrics: { ...baseline.metrics, controlRadius: NaN } })
		).toBeNull();
		expect(parseTheme({ ...baseline, fonts: { ui: '__proto__', mono: 'geist' } })).toBeNull();
	});
	it('keeps a saved copy independent of its source', () => {
		const copy = parseTheme({ ...baseline, id: 'custom:test', name: 'Моя тема' })!;
		copy.colors.dark.accent = '#ff0000';
		copy.metrics.controlRadius = 12;
		expect(baseline.colors.dark.accent).not.toBe('#ff0000');
		expect(baseline.metrics.controlRadius).toBe(3);
	});
	it('preserves baseline geometry and resolves device sizing without mutating the theme', () => {
		const values = resolveAppearance(baseline, defaultDevice, 'dark');
		expect(values['--cg-radius-control']).toBe('0.1875rem');
		expect(values['--cg-control-height']).toBe('2rem');
		expect(values['--cg-axis-height']).toBe('2.75rem');
		const large = resolveAppearance(baseline, { ...defaultDevice, textScale: 1.5 }, 'light');
		expect(large['--cg-axis-height']).toBe('4.125rem');
		expect(large['--cg-text-size-control']).toBe('1.21875rem');
		expect(baseline.metrics.control).toBe(13);
	});
	it('clamps effective panels while retaining preferred widths', () => {
		const device = { ...defaultDevice, railWidth: 480, contextWidth: 600 };
		const narrow = panelWidths(1000, device);
		expect(1000 - narrow.context - narrow.rail).toBeGreaterThanOrEqual(280);
		expect(device.contextWidth).toBe(600);
		expect(panelWidths(1600, device)).toEqual({ context: 600, rail: 480 });
		expect(parseDevice({ ...device, density: Infinity })).toBeNull();
		// An older cache without the legend flag reads as «shown»; a wrong type is refused.
		const { legendOpen: _legendOpen, ...older } = device;
		void _legendOpen;
		expect(parseDevice(older)?.legendOpen).toBe(true);
		expect(parseDevice({ ...device, legendOpen: false })?.legendOpen).toBe(false);
		expect(parseDevice({ ...device, legendOpen: 'yes' })).toBeNull();
		// The row arrangement (loop 006): absent or null is the default order, a saved one is copied, a malformed one refused.
		const noRows = Object.fromEntries(
			Object.entries(device).filter(([key]) => key !== 'rowArrangement')
		);
		expect(parseDevice(noRows)?.rowArrangement).toBeNull();
		expect(parseDevice({ ...device, rowArrangement: null })?.rowArrangement).toBeNull();
		const lanes = { lanes: [{ members: ['a', 'b'], name: 'AB' }, { members: ['c'] }] };
		expect(parseDevice({ ...device, rowArrangement: lanes })?.rowArrangement).toEqual(lanes);
		expect(parseDevice({ ...device, rowArrangement: { lanes: [{ members: [] }] } })).toBeNull();
		expect(parseDevice({ ...device, rowArrangement: 'rows' })).toBeNull();
		// The lens strength (loop 008): absent reads as the default 55, 0 turns the veil off, out of range or wrong type is refused.
		const { lens: _lens, ...noLens } = device;
		void _lens;
		expect(parseDevice(noLens)?.lens).toBe(55);
		expect(defaultDevice.lens).toBe(55);
		expect(parseDevice({ ...device, lens: 0 })?.lens).toBe(0);
		expect(parseDevice({ ...device, lens: 100 })?.lens).toBe(100);
		expect(parseDevice({ ...device, lens: 101 })).toBeNull();
		expect(parseDevice({ ...device, lens: -1 })).toBeNull();
		expect(parseDevice({ ...device, lens: '55' })).toBeNull();
	});
});
