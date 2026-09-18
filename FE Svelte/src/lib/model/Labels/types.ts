import type { Mark } from '$lib/model/Projection/types';

/** A mark placed on the canvas: its track and pixel rectangle. */
export type MarkBox = Readonly<{
	mark: Mark;
	/** Track index inside the row; fuzzy underlays have no track (-1). */
	track: number;
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}>;

/** A caption placed next to a mark, as a pixel rectangle around the text. */
export type LabelBox = Readonly<{
	markId: string;
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	selected: boolean;
}>;

/** Text width in pixels for the caption font; the canvas passes `measureText`. */
export type MeasureText = (text: string) => number;

export type LabelOptions = Readonly<{
	measure: MeasureText;
	selectedTraceId: string | null;
	/** Canvas width; labels fully outside it are not placed. */
	widthPx: number;
	fontPx: number;
	/** Vertical space shared by captions and their hit areas. */
	bounds?: Readonly<{ top: number; bottom: number }>;
}>;
