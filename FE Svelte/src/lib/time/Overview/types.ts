import type { ProjectedRow, TimeRange } from '$lib/model/Projection/types';
import type { ScopeColour } from '$lib/theme/scope-colour';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';

export type OverviewProps = Readonly<{
	viewport: ViewportState;
	phone?: boolean;
	canReveal?: boolean;
	onreveal?: () => void;
	inWindow: number;
	/** Whole data range on the axis; the strip spans it with the window padded in. */
	extent: TimeRange | null;
	/** The rows the ribbon shows: the density and the inlays read their marks — exactly what the ribbon draws (B4). */
	rows: readonly ProjectedRow[];
	/** Records the search does not match: they weigh 18 % in the density and the inlays (research п. 9). */
	dimmed?: ReadonlySet<string>;
}>;

/** A record's time with the weight it adds to the density; 1 when unsaid. */
export type WeightedRange = TimeRange & Readonly<{ weight?: number }>;

/**
 * A 2 px colour inlay of the strip (Q2-E): at the record's time, the colours of its coloured
 * Scopes as layers top to bottom, at this alpha (1; a roll-up 0.55; a search miss × 0.18).
 */
export type OverviewInlay = Readonly<{
	t: number;
	colours: readonly ScopeColour[];
	alpha: number;
}>;

export type OverviewPalette = Readonly<{
	ink: string;
	accent: string;
	border: string;
	surface: string;
	mono: string;
	/** The colour of a Scope colour on the theme's base (`theme/scope-colour.ts`). */
	scope: (colour: ScopeColour) => string;
}>;

/** Which part of the frame a drag started on. */
export type FrameGrip = 'body' | 'start' | 'end';
