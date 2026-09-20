import type { AxisBand, AxisUnit, AxisWindow, PeriodRef } from '$lib/model/Axis/types';

export type AxisProps = Readonly<{
	window: AxisWindow;
	/** Epoch milliseconds of «сейчас». */
	now: number;
	selected?: PeriodRef | null;
	/** Which periods carry a note: a bar along the top edge of their cell, `data-note` on the twin. */
	hasNote?: (period: PeriodRef) => boolean;
	onselectperiod?: (period: PeriodRef) => void;
	onpan?: (ratio: number) => void;
}>;

export type AxisRow = 'major' | 'week' | 'minor';

/** Clickable area of one axis cell, in canvas pixels, with the text it shows or would show. */
export type AxisHit = Readonly<{
	x0: number;
	x1: number;
	y0: number;
	y1: number;
	row: AxisRow;
	unit: AxisUnit;
	start: number;
	end: number;
	label: string;
	/** The label is on the canvas: on its boundary or pinned at the left edge. */
	drawn: boolean;
	/** Pinned at the left edge on a plate because the cell is cut by the edge. */
	pinned: boolean;
	/** The period has a note: an accent bar runs along the top edge of the cell. */
	note: boolean;
}>;

/** What one draw leaves behind: the hit areas of the DOM twin and the band to remember. */
export type AxisDraw = Readonly<{ hits: AxisHit[]; band: AxisBand }>;

/** Colours the axis reads from the surrounding theme once per draw. */
export type AxisPalette = Readonly<{
	ink: string;
	inkSecondary: string;
	muted: string;
	accent: string;
	accentSubtle: string;
	border: string;
	borderStrong: string;
	surface: string;
	sans: string;
	mono: string;
}>;

export type AxisMetrics = Readonly<{
	heightPx: number;
	majorFont: string;
	minorFont: string;
	weekFont: string;
}>;
