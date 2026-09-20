import type { ScopeColour } from '$lib/theme/scope-colour';

/**
 * The picker is a skin over the Scope's colour pair: it shows `{hue, chroma}` and reports
 * every pick as a whole pair, or `null` for «без цвета». A richer picker keeps these props.
 */
export type ColorHuePickerProps = Readonly<{
	/** The Scope's hue, an integer degree 0–359; `null` is «без цвета». */
	hue: number | null;
	/** The Scope's saturation 0–100; `null` is the default (100). */
	chroma: number | null;
	/** The Scope's depth 0–2; `null` is 0 (C6). The plain bars keep it; the flower picks it. */
	depth?: number | null;
	onpick: (colour: ScopeColour | null) => void;
	/** The accessible name of the group; the heading the form shows above it. */
	label: string;
	testId?: string;
}>;
