import type { AxisUnit, AxisWindow, PeriodRef } from '$lib/model/Axis/types';

export type AxisProps = Readonly<{
	window: AxisWindow;
	/** Epoch milliseconds of «сейчас». */
	now: number;
	selected?: PeriodRef | null;
	onselectperiod?: (period: PeriodRef) => void;
	onpan?: (ratio: number) => void;
}>;

export type AxisRow = 'major' | 'week' | 'minor' | 'sticky';

/** Clickable area of one axis label, in canvas pixels, with the text it shows. */
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
}>;

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
