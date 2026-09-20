import type {
	BlossomColorPickerColor,
	BlossomColorPickerValue
} from '@dayflow/blossom-color-picker';
import type { Snippet } from 'svelte';

export type Hsl = Readonly<{ h: number; s: number; l: number }>;

/**
 * One petal as the flower shell knows it: its index in the palette, the hex the library would
 * read, and how Blossom reads it — its `hsl.h` is the petal's identity in the callbacks, unique
 * across the palette; the library is handed the `hsl` itself. A model over the shell (the
 * Scope's colour, a theme colour) adds what a petal means to it, and may name the petal's
 * `ring` (0 innermost): a palette whose every petal names one is laid out in those rings
 * (`rings.ts`); otherwise the library rings it by lightness, `layer` telling which.
 */
export type Petal = Readonly<{
	index: number;
	hex: string;
	hsl: Hsl;
	layer: 'inner' | 'outer';
	ring?: number;
}>;

/** Where a Blossom change came from: a petal button or the arc slider. */
export type BlossomSource = 'petal' | 'arc';

export type FlowerWords = Readonly<{
	/** The accessible name of the flower group. */
	group: string;
	/** The accessible name of a petal, by its index. */
	petal: (index: number) => string;
}>;

/**
 * The skinned flower: the library's petals, arc and core repainted from the caller's model.
 * The shell knows no colour rule — a model hands it the palette (identity and what is shown),
 * the controlled value, the arc's gradient and the colour picked, and reads every change back
 * with its source.
 */
export type BlossomFlowerProps = Readonly<{
	/** The palette the library is handed: stable while the arc moves, or the library rebuilds the flower. */
	petals: readonly Petal[];
	/** What each petal shows now, by index; the skin paints it over the library's inline colour. */
	shown: readonly string[];
	value: BlossomColorPickerValue;
	/** The petal marked as the current one; `null` marks none. */
	selected: number | null;
	/** The arc's gradient, `ARC_STOPS` colours from the arc's start (0) to its end (100). */
	arc: readonly string[];
	/** The colour picked: the core, the arc's handle and the ring; `null` is an empty ink ring. */
	colour: string | null;
	words: FlowerWords;
	onchange: (change: BlossomColorPickerColor, source: BlossomSource) => void;
	/** The flower's own test id; a clickable petal gets `${testId}-petal-${index}`. */
	testId?: string;
	/** A petal's diameter in px; the library's 32 unless the palette needs a tighter bloom. */
	petalSize?: number;
}>;

/**
 * The trigger and the panel: a round swatch of the colour picked that opens a native popover
 * over the form, anchored to itself; the caller fills the panel (the flower and its buttons).
 */
export type BlossomPopoverProps = Readonly<{
	id: string;
	/** The field's name — «Цвет»: the trigger's and the panel's accessible name starts with it. */
	label: string;
	/** The colour in words — the trigger's tooltip and the rest of its accessible name. */
	readout: string;
	/** The swatch's colour; `null` is an empty ink ring («без цвета») — or nothing, as a `dot`. */
	colour: string | null;
	/** The trigger's whole accessible name and tooltip, when not «label: readout». */
	name?: string;
	/**
	 * `field`: the 24 px swatch of a form field, ringed at rest. `dot`: the plain dot of the
	 * ribbon beside a name, ringed only under the pointer or the focus; transparent without a colour.
	 */
	variant?: 'field' | 'dot';
	/** The trigger's diameter in px; `SWATCH_SIZE_PX` by default. */
	size?: number;
	disabled?: boolean;
	/** The trigger gets `${testId}-swatch`, the panel `${testId}-popover`. */
	testId?: string;
	/** Data the trigger carries for the specs, `data-color-*` in the Scope editor. */
	data?: Record<`data-${string}`, string | undefined>;
	/** Rendered while the panel is open, so a flower blooms on every opening. */
	children: Snippet;
}>;
