import { describe, expect, it } from 'vitest';
import { scopeColour } from '$lib/theme/scope-colour';
import { TINT_BACKGROUND_PERCENT, TINT_BORDER_PERCENT } from './constants';
import { fitPath } from './path';
import { chipTint } from './tint';

describe('chipTint', () => {
	it('washes the colour of the hue in the current mode to the chip strengths', () => {
		const dark = scopeColour(150, 40, 'dark');
		expect(chipTint(150, 40, 'dark')).toBe(
			`--chip-bg: color-mix(in srgb, ${dark} ${TINT_BACKGROUND_PERCENT}%, transparent); ` +
				`--chip-border: color-mix(in srgb, ${dark} ${TINT_BORDER_PERCENT}%, transparent)`
		);
		expect(chipTint(150, 40, 'light')).toContain(scopeColour(150, 40, 'light'));
		expect(chipTint(150, 40, 'light')).not.toBe(chipTint(150, 40, 'dark'));
		// The saturation left unsaid is the default.
		expect(chipTint(150, null, 'dark')).toBe(chipTint(150, 100, 'dark'));
		expect(chipTint(150, undefined, 'dark')).toBe(chipTint(150, 100, 'dark'));
	});

	it('leaves a Scope without a hue on the neutral chip', () => {
		expect(chipTint(null, null, 'dark')).toBeUndefined();
		expect(chipTint(undefined, 50, 'light')).toBeUndefined();
	});

	it('keeps the wash lighter under the text than on the edge, so ink stays legible', () => {
		expect(TINT_BACKGROUND_PERCENT).toBeLessThan(TINT_BORDER_PERCENT);
		expect(TINT_BACKGROUND_PERCENT).toBeLessThanOrEqual(25);
	});
});

describe('fitPath: «Корень › … › Лист» in its room', () => {
	const widths = { ancestors: [60, 80, 70], leaf: 50, separator: 10, ellipsis: 12 };
	it('keeps the whole path while it fits, the ancestors shrinking first', () => {
		expect(fitPath({ ...widths, available: 400 })).toEqual({ kept: [0, 1, 2], ellipsis: false });
		// 3 × 28 + 3 × 10 + 50 = 164: the ancestors truncate, all still shown.
		expect(fitPath({ ...widths, available: 164 })).toEqual({ kept: [0, 1, 2], ellipsis: false });
	});
	it('then collapses the middle to «…», keeping the root while root, «…» and the leaf fit', () => {
		expect(fitPath({ ...widths, available: 163 })).toEqual({ kept: [0], ellipsis: true });
		// 28 + 12 + 20 + 50 = 110.
		expect(fitPath({ ...widths, available: 110 })).toEqual({ kept: [0], ellipsis: true });
		expect(fitPath({ ...widths, available: 109 })).toEqual({ kept: [], ellipsis: true });
		expect(fitPath({ ...widths, available: 20 })).toEqual({ kept: [], ellipsis: true });
	});
	it('a single ancestor collapses to «…» alone; a Scope without ancestors is its name', () => {
		expect(fitPath({ ...widths, ancestors: [60], available: 200 })).toEqual({
			kept: [0],
			ellipsis: false
		});
		expect(fitPath({ ...widths, ancestors: [60], available: 70 })).toEqual({
			kept: [],
			ellipsis: true
		});
		expect(fitPath({ ...widths, ancestors: [], available: 10 })).toEqual({
			kept: [],
			ellipsis: false
		});
	});
});
