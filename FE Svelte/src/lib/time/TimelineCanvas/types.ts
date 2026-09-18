import type { ProjectedRow, TimeRange, TraceLink } from '$lib/model/Projection/types';

/** Where a selection was made; only choices made off the canvas move the window (DP7). */
export type SelectSource = 'canvas' | 'twin' | 'rail' | 'context' | 'history' | 'axis' | 'parked';

export type TimelineCanvasProps = Readonly<{
	rows: readonly ProjectedRow[];
	window: TimeRange;
	/** Epoch milliseconds of «сейчас». */
	now: number;
	selectedTraceId: string | null;
	links: readonly TraceLink[];
	showScopeRange: boolean;
	/** Height of every row, shared with the Scope rail (C9a-2). */
	rowHeightPx: number;
	minHeightPx?: number;
	onselect: (traceId: string, source: SelectSource) => void;
	/** Several records under one click: the window should close in on their range. */
	onzoomto: (range: TimeRange, traceIds: readonly string[]) => void;
	/** A clean click on empty canvas (no mark, no caption); a drag never gets here. */
	onempty?: () => void;
}>;

/** Colours the ribbon reads from the surrounding theme once per appearance change. */
export type CanvasPalette = Readonly<{
	ink: string;
	inkSecondary: string;
	muted: string;
	accent: string;
	accentMuted: string;
	border: string;
	borderStrong: string;
	surface: string;
	secondaryInk: string;
	sans: string;
	mono: string;
}>;

export type CanvasMetrics = Readonly<{
	/** Caption size in CSS pixels, from `--cg-text-size-caption`. */
	captionPx: number;
}>;
