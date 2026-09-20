import type { Mark } from '$lib/model/Projection/types';

/** A mark placed on the canvas: its track and pixel rectangle. */
export type MarkBox = Readonly<{
	mark: Mark;
	/** Track index inside the row. */
	track: number;
	x0: number;
	x1: number;
	y0: number;
	y1: number;
}>;

/** A caption placed next to a mark, as a pixel rectangle around the text. */
export type LabelBox = Readonly<{
	markId: string;
	/** The text as drawn at rest: the record's label, cut to `CAPTION_MAX_CHARS` with «…» when longer (Q1-A). */
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	selected: boolean;
}>;

/** Text width in pixels for the caption font; the canvas passes `measureText`. */
export type MeasureText = (text: string) => number;

/** The scale tier the captions follow (Q1-A п. 3): «год» and coarser, «квартал»/«месяц», «неделя»/«день». */
export type CaptionTier = 'year' | 'month' | 'week';

/**
 * What the caption budget serves first (Q1-A п. 1): open intentions and «длится», then
 * intervals, then facts with explicit links, then other facts.
 */
export type CaptionClass = 'intention' | 'interval' | 'linked' | 'fact';

export type LabelOptions = Readonly<{
	measure: MeasureText;
	selectedTraceId: string | null;
	/** Canvas width; labels fully outside it are not placed, and the caption budget is one per `CAPTION_BUDGET_PX` of it. */
	widthPx: number;
	fontPx: number;
	/** Vertical space shared by captions and their hit areas. */
	bounds?: Readonly<{ top: number; bottom: number }>;
	/** The scale tier; everything is admitted when unsaid. */
	tier?: CaptionTier;
	/** Records an explicit link touches, by traceId: facts among them rank before other facts. */
	linked?: ReadonlySet<string>;
}>;

/** How a record stands out at draw time: bold and full force, caption forced, or dimmed by the search. */
export type Emphasis = Readonly<{
	/** The selected or the lit (hovered) record: full force, 600 ink caption (п. 4, 5). */
	strong: boolean;
	/** The caption draws even where the collision rule, the budget or the tier would hide it (п. 5, 9; Q1-A). */
	forced: boolean;
	/** The search does not match the record: 18 % (п. 9). */
	dim: boolean;
}>;

/** A caption as it draws: the placed text with its emphasis and whether it needs a backing. */
export type Caption = Readonly<{
	label: LabelBox;
	strong: boolean;
	/** Drawn over a canvas-tone plate because it overlaps a neighbour's mark or another caption. */
	backing: boolean;
	/** 1, or the search dimness for a record the query does not match. */
	alpha: number;
}>;

export type CaptionOptions = Readonly<{
	selectedTraceId: string | null;
	/** Records lit by the hover, by traceId. */
	lit: ReadonlySet<string>;
	/** Records the search does not match, by traceId. */
	dimmed: ReadonlySet<string>;
	/** A search is on: the matches' captions are forced. */
	searching: boolean;
	measure: MeasureText;
	/** Width in the 600 caption font the strong captions draw in; `measure` when unsaid. */
	measureStrong?: MeasureText;
	fontPx: number;
	widthPx: number;
}>;

/** What `resolveCaptions` reads of a laid-out row. */
export type CaptionRow = Readonly<{
	boxes: readonly MarkBox[];
	labels: readonly LabelBox[];
	y0: number;
	y1: number;
}>;
