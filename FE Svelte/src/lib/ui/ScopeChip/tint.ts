import { scopeColour, type ScopeGround } from '$lib/theme/scope-colour';
import { TINT_BACKGROUND_PERCENT, TINT_BORDER_PERCENT } from './constants';

/**
 * The inline custom properties of a tinted chip: the Scope's colour on the theme's ground
 * (R1: hue through `scopeColour`; C6: at its depth) washed to the chip's two strengths. A
 * Scope without a hue gets none, and the chip keeps its neutral surface and outline.
 */
export const chipTint = (
	colorHue: number | null | undefined,
	colorChroma: number | null | undefined,
	ground: ScopeGround,
	colorDepth: number | null | undefined = null
): string | undefined => {
	if (colorHue === null || colorHue === undefined) return undefined;
	const colour = scopeColour(colorHue, colorChroma ?? null, ground, colorDepth);
	return [
		`--chip-bg: color-mix(in srgb, ${colour} ${TINT_BACKGROUND_PERCENT}%, transparent)`,
		`--chip-border: color-mix(in srgb, ${colour} ${TINT_BORDER_PERCENT}%, transparent)`
	].join('; ');
};
