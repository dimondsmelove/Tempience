import type { TimeRange } from '$lib/model/Projection/types';
import type { ViewportState } from '$lib/state/Viewport/Viewport.svelte';

export type OverviewProps = Readonly<{
	viewport: ViewportState;
	phone?: boolean;
	canReveal?: boolean;
	onreveal?: () => void;
	inWindow: number;
	/** Whole data range on the axis; the strip spans it with the window padded in. */
	extent: TimeRange | null;
	/** Times of every record on the axis, for the density. */
	times: ReadonlyMap<string, TimeRange>;
}>;

export type OverviewPalette = Readonly<{
	ink: string;
	accent: string;
	border: string;
	surface: string;
	mono: string;
}>;

/** Which part of the frame a drag started on. */
export type FrameGrip = 'body' | 'start' | 'end';
