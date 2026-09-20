import type { LabelBox, MarkBox, MeasureText } from '$lib/model/Labels/types';
import type { ProjectedRow, TimeRange } from '$lib/model/Projection/types';

export type RowLayout = Readonly<{
	row: ProjectedRow;
	y0: number;
	y1: number;
	/** Tracks the visible marks need; sets the track height (DESIGN.md §4). */
	tracks: number;
	trackHeight: number;
	boxes: readonly MarkBox[];
	labels: readonly LabelBox[];
	/** Scope range in canvas pixels, clipped to the canvas. */
	rangeX: Readonly<{ x0: number; x1: number }> | null;
}>;

export type RibbonLayout = Readonly<{
	rows: readonly RowLayout[];
	widthPx: number;
	heightPx: number;
	window: TimeRange;
	pxPerDay: number;
	/** Canvas x of a time. */
	x: (t: number) => number;
}>;

export type LayoutOptions = Readonly<{
	window: TimeRange;
	widthPx: number;
	measure: MeasureText;
	selectedTraceId: string | null;
	fontPx?: number;
	/** Height of every row; the minimum 52 px unless the rows have more room (C9a-2). */
	rowHeightPx?: number;
	/** Extend the canvas below the rows without changing their geometry. */
	minHeightPx?: number;
	/** Records an explicit link touches, by traceId: such facts rank before other facts for the caption budget (Q1-A). */
	linked?: ReadonlySet<string>;
}>;
