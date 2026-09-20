import { FOCUS_COLUMN_ALPHA } from '$lib/model/Focus/constants';
import type { FocusSet } from '$lib/model/Focus/types';
import type { HoverTarget } from '$lib/model/Hover/types';
import { emphasisOf, resolveCaptions } from '$lib/model/Labels/captions';
import type { Caption, CaptionOptions, MarkBox, MeasureText } from '$lib/model/Labels/types';
import type { RibbonLayout, RowLayout } from '$lib/model/Layout/types';
import { underVeil } from '$lib/model/Lens/Lens';
import type { LensSet } from '$lib/model/Lens/types';
import { markColours, markStyle, rowColours } from '$lib/model/MarkStyle/MarkStyle';
import type { MarkStyle } from '$lib/model/MarkStyle/types';
import type { TraceLink } from '$lib/model/Projection/types';
import { SEARCH_DIM_ALPHA } from '$lib/model/Search/constants';
import { paintCaptions } from './captions';
import { SCOPE_RANGE_ALPHA, SCOPE_RANGE_TONE } from './constants';
import { drawColumn, drawGround, line } from './ground';
import { drawBrackets, drawClosing, drawProjections, type Placed } from './links';
import { drawMarkBox, drawPulseRing } from './marks';
import type { CanvasMetrics, CanvasPalette } from './types';

export type DrawRibbonInput = Readonly<{
	context: CanvasRenderingContext2D;
	dpr: number;
	layout: RibbonLayout;
	palette: CanvasPalette;
	metrics: CanvasMetrics;
	now: number;
	selectedTraceId: string | null;
	links: readonly TraceLink[];
	/** The selected record's brackets are drawn; the hovered record's are drawn regardless (loop 008, B). */
	linksShown: boolean;
	/** Records in full force with their captions forced, by traceId: the focus and the lens as one (п. 5; loop 008). */
	lit: ReadonlySet<string>;
	/** What the Context keeps in view (loop 008, A): its column, if a period. */
	focus: FocusSet;
	/** What the pointer rests on and what the lens draws above the veil for it (loop 008, B). */
	hover: HoverTarget;
	lens: LensSet;
	/** The veil's alpha right now, eased by the canvas; 0 draws no veil. */
	veil: number;
	/** «Куда смотреть» (C3): the records to ring and how far the ring has grown, 0…1; null when none. */
	pulse: Readonly<{ traceIds: ReadonlySet<string>; progress: number }> | null;
	/** Records the search does not match, by traceId (п. 9). */
	dimmed: ReadonlySet<string>;
	searching: boolean;
	/** Caption widths in the caption font; the canvas passes its cached `measureText`. */
	measure: MeasureText;
	/** The same in the 600 font the strong captions draw in. */
	measureStrong: MeasureText;
}>;

/**
 * Draws the whole ribbon for one layout: ground, rows, ranges, the focus column, marks —
 * a closed intention's closing with them while its caption is forced (C4) — captions,
 * links, «сейчас» — then, under a hover with the lens on, the veil over the rows and the
 * lens's own content again above it (loop 008, B). Returns the captions it drew, row by
 * row, so the DOM twin can say what the canvas shows.
 */
export const drawRibbon = (input: DrawRibbonInput): readonly Caption[][] => {
	const { context: g, dpr, layout, palette, metrics, now, selectedTraceId, links } = input;
	const W = layout.widthPx;
	const H = layout.heightPx;
	const nowX = layout.x(now);
	/** The rows area the veil and the columns cover: the canvas may run on below the last row. */
	const rowsBottom = layout.rows.at(-1)?.y1 ?? H;
	/** The mark language, then the hover's full force and the search's 18 % (п. 5, 9). */
	const styleOf = (box: MarkBox): MarkStyle => {
		const id = box.mark.traceId;
		const selected = id === selectedTraceId;
		const lit = input.lit.has(id);
		const style = markStyle(box.mark, { selected, lit });
		return !selected && !lit && input.dimmed.has(id)
			? { ...style, alpha: style.alpha * SEARCH_DIM_ALPHA }
			: style;
	};
	// Captions: at rest within the row's budget and cut to length (Q1-A); the forced read in full.
	// Resolved before the marks: the closing hairline (C4) yields to the captions of its row.
	const captionOptions: CaptionOptions = {
		selectedTraceId,
		lit: input.lit,
		dimmed: input.dimmed,
		searching: input.searching,
		measure: input.measure,
		measureStrong: input.measureStrong,
		fontPx: metrics.captionPx,
		widthPx: W
	};
	const drawn: Caption[][] = layout.rows.map((row) => resolveCaptions(row, captionOptions));
	/** The mark, and — for a closed intention whose caption is forced — its closing marker and hairline in the same pass (C4). */
	const paint = (placed: Placed): void => {
		const style = styleOf(placed.box);
		drawMarkBox(g, placed.box, style, placed.colours, palette.ink);
		const { closedAt, traceId } = placed.box.mark;
		if (closedAt !== undefined && emphasisOf(traceId, captionOptions).forced)
			drawClosing(g, placed, style, layout.x(closedAt), W, drawn[placed.rowIndex], palette);
	};
	const drawRange = (row: RowLayout): void => {
		if (!row.rangeX) return;
		const [colour] = rowColours(row.row, palette);
		const coloured = colour !== palette.ink;
		g.fillStyle = coloured ? colour : palette.border;
		g.globalAlpha = coloured ? SCOPE_RANGE_TONE : SCOPE_RANGE_ALPHA;
		g.fillRect(row.rangeX.x0, row.y0 + 1, row.rangeX.x1 - row.rangeX.x0, row.y1 - row.y0 - 2);
		g.globalAlpha = 1;
	};
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, W, H);

	drawGround(g, layout, palette, nowX);

	// Scope ranges from the first to the last record of the row: the Scope colour at 7 %, border at 40 % without one.
	// Always on (research п. 10): the band is part of the row, not a legend kind.
	for (const row of layout.rows) drawRange(row);

	// Row separators.
	g.strokeStyle = palette.border;
	g.lineWidth = 1;
	for (const row of layout.rows) {
		g.beginPath();
		g.moveTo(0, row.y1 - 0.5);
		g.lineTo(W, row.y1 - 0.5);
		g.stroke();
	}

	// The focused period's column (loop 008, A): under the marks, kept while the Context shows it.
	if (input.focus.range)
		drawColumn(g, layout, input.focus.range, rowsBottom, palette.accent, FOCUS_COLUMN_ALPHA);

	// Marks in their Scope colours — the row's, or in a merged row the members' the record answers
	// to, woven when several (п. 7): roll-ups under direct records, lit records over them, the selected on top.
	const selected: Placed[] = [];
	const lit: Placed[] = [];
	const placedByTraceId = new Map<string, Placed[]>();
	/** The marks of each row in view, in paint order — roll-ups, the rest, the lit — for the veil pass; the selected apart. */
	const placedRows: Placed[][] = [];
	const rank = (placed: Placed): number =>
		input.lit.has(placed.box.mark.traceId) ? 2 : placed.box.mark.rollup ? 0 : 1;
	layout.rows.forEach((row, rowIndex) => {
		const rowCentreY = (row.y0 + row.y1) / 2;
		const inRow: Placed[] = [];
		const later: Placed[] = [];
		for (const box of row.boxes) {
			const colours = markColours(row.row, box.mark, palette);
			const placed: Placed = { box, rowIndex, rowCentreY, colours };
			const id = box.mark.traceId;
			(placedByTraceId.get(id) ?? placedByTraceId.set(id, []).get(id))!.push(placed);
			if (box.x1 < 0 || box.x0 > W) continue;
			if (id === selectedTraceId) selected.push(placed);
			else if (input.lit.has(id)) lit.push(placed);
			else if (box.mark.rollup) paint(placed);
			else later.push(placed);
			inRow.push(placed);
		}
		for (const placed of later) paint(placed);
		placedRows.push(inRow.toSorted((a, b) => rank(a) - rank(b)));
	});
	for (const placed of lit) paint(placed);

	if (selectedTraceId) {
		drawProjections(g, placedByTraceId.get(selectedTraceId) ?? [], palette, selectedTraceId);
		if (input.linksShown)
			drawBrackets(g, selectedTraceId, placedByTraceId, links, palette, selectedTraceId);
		for (const placed of selected) paint(placed);
	}

	for (const captions of drawn) paintCaptions(g, captions, palette, metrics);

	// «Сейчас» on top of everything.
	if (nowX >= 0 && nowX <= W) {
		g.strokeStyle = palette.accent;
		g.lineWidth = 1;
		line(g, nowX, 0, H);
	}

	// The lens (loop 008, B): the page tone over the rows at the veil's alpha, then what the pointer
	// asks for again above it — a hovered row whole, with its band and every caption; otherwise the
	// lit marks in every row, their captions, the hovered record's brackets and a hovered period's column.
	const { hover, lens, veil } = input;
	if (veil > 0 && hover) {
		g.fillStyle = palette.canvas;
		g.globalAlpha = veil;
		g.fillRect(0, 0, W, rowsBottom);
		g.globalAlpha = 1;
		const above = (placed: Placed): boolean => !underVeil(hover, lens, placed.box.mark);
		if (hover.kind === 'row') {
			const index = layout.rows.findIndex((row) => row.row.id === hover.rowId);
			if (index >= 0) drawRange(layout.rows[index]);
		}
		if (lens.range)
			drawColumn(g, layout, lens.range, rowsBottom, palette.accent, FOCUS_COLUMN_ALPHA);
		const idOf = (placed: Placed): string => placed.box.mark.traceId;
		for (const row of placedRows)
			for (const placed of row)
				if (above(placed) && idOf(placed) !== selectedTraceId) paint(placed);
		if (hover.kind === 'trace')
			drawBrackets(g, hover.traceId, placedByTraceId, links, palette, selectedTraceId);
		for (const placed of selected) if (above(placed)) paint(placed);
		const shown = new Set(
			placedRows
				.flat()
				.filter(above)
				.map((placed) => placed.box.mark.id)
		);
		for (const captions of drawn)
			paintCaptions(
				g,
				captions.filter((caption) => shown.has(caption.label.markId)),
				palette,
				metrics
			);
	}

	// «Куда смотреть» (C3): the ring grows once around every projection of the record chosen in
	// the Context, above the veil and everything else.
	const { pulse } = input;
	if (pulse && pulse.progress < 1)
		for (const id of pulse.traceIds)
			for (const placed of placedByTraceId.get(id) ?? [])
				if (placed.box.x1 >= 0 && placed.box.x0 <= W)
					drawPulseRing(
						g,
						placed.box,
						markStyle(placed.box.mark, { selected: id === selectedTraceId }),
						placed.colours.length > 1,
						pulse.progress,
						palette.ink
					);
	return drawn;
};
