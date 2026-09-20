import { describe, expect, it } from 'vitest';
import { scopeColour } from '$lib/theme/scope-colour';
import { TINT_BACKGROUND_PERCENT, TINT_BORDER_PERCENT } from './constants';
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
