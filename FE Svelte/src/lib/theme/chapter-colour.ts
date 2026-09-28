import { appearance } from '$lib/theme/appearance.svelte';
import { scopeColour } from '$lib/theme/scope-colour';

type Coloured = Readonly<{
	colorHue: number | null;
	colorChroma: number | null;
	colorDepth?: number | null;
}>;

/**
 * A chapter's colour by the rule the ribbon draws Scopes with (DESIGN §2): hue, saturation and
 * depth over the theme's base; `none` (muted text) when it has none. Components only — the
 * workbench state reads no theme.
 */
export const chapterColour = (
	item: Coloured | null | undefined,
	none = 'var(--cg-text-muted)'
): string =>
	item?.colorHue === null || item?.colorHue === undefined
		? none
		: scopeColour(item.colorHue, item.colorChroma, appearance.scopeBase, item.colorDepth ?? null);
