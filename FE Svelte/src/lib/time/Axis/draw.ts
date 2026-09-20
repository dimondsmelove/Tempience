import type { Locale } from '$lib/state/Locale/types';
import { axisRows, floorUnit, isoWeek, tickLabel, unitBoundaries } from '$lib/model/Axis/Axis';
import { LABEL_INSET_PX, LABEL_PADDING_PX, PIN_X_PX } from '$lib/model/Axis/constants';
import { placeLabels } from '$lib/model/Axis/placement';
import type { AxisBand, AxisTick, AxisWindow, PeriodRef } from '$lib/model/Axis/types';
import {
	AXIS_FONT_MAJOR,
	AXIS_FONT_MINOR,
	AXIS_FONT_WEEK,
	AXIS_HEIGHT_PX,
	CURRENT_WEEK_UNDERLINE_PX,
	CURRENT_WEEK_UNDERLINE_WIDTH_PX,
	GHOST_ALPHA,
	MINOR_TICK_PX,
	NOTE_BAR_ALPHA,
	NOTE_BAR_PX,
	PLATE_INSET_PX,
	PLATE_RADIUS_PX,
	scaledAxisRows,
	ZEBRA_ALPHA
} from './constants';
import { measureWidths } from './measure';
import type { AxisDraw, AxisHit, AxisMetrics, AxisPalette, AxisRow } from './types';

export type DrawAxisInput = Readonly<{
	context: CanvasRenderingContext2D;
	widthPx: number;
	dpr: number;
	window: AxisWindow;
	now: number;
	selected: PeriodRef | null;
	palette: AxisPalette;
	metrics?: AxisMetrics;
	/** Periods with a saved note get an accent bar along the top edge of their cell, in every row. */
	hasNote?: (period: PeriodRef) => boolean;
	/** The language the labels are drawn in. */
	language?: Locale;
	/** The cell under the pointer or keyboard focus; off the step, its label shows as a ghost. */
	hover?: PeriodRef | null;
	/** The band of the previous draw: a threshold is crossed only 4 % beyond it. */
	previousBand?: AxisBand | null;
}>;

/** One row of the axis: its cells, font, vertical band and the marks its cells get. */
type RowLayout = Readonly<{
	row: AxisRow;
	cells: readonly AxisTick[];
	font: string;
	hit: readonly [number, number];
	textY: number;
	/** Colour of a drawn label. */
	ink: (cell: AxisTick) => string;
	/** Width of the underline under a drawn label, 0 for none, and the y it sits at. */
	underline?: (cell: AxisTick, textWidth: number) => number;
	underlineY?: number;
	/** The boundary mark at a cell's start. */
	tick: (px: number, labelled: boolean) => void;
}>;

const samePeriod = (a: PeriodRef | null | undefined, b: PeriodRef): boolean =>
	a != null && a.unit === b.unit && a.start === b.start;

/** Draws the axis into the context and returns the cell areas of every row and the band drawn. */
export const drawAxis = (input: DrawAxisInput): AxisDraw => {
	const { context: g, widthPx: W, dpr, window, now, selected, palette, hover } = input;
	const hasNote = input.hasNote ?? (() => false);
	const height = input.metrics?.heightPx ?? AXIS_HEIGHT_PX;
	const language = input.language ?? 'ru';
	const fonts = {
		major: `${input.metrics?.majorFont ?? AXIS_FONT_MAJOR} ${palette.mono}`,
		week: `${input.metrics?.weekFont ?? AXIS_FONT_WEEK} ${palette.mono}`,
		minor: `${input.metrics?.minorFont ?? AXIS_FONT_MINOR} ${palette.mono}`
	};
	const textScale = height / AXIS_HEIGHT_PX;
	const rows = axisRows(window, W, {
		textScale,
		language,
		widths: measureWidths(g, fonts, language),
		previous: input.previousBand
	});
	const { spec } = rows;
	const context = { spec, language };
	const layouts = scaledAxisRows(textScale);
	const three = spec.middle === 'week';
	const layout = three ? layouts.three : layouts.two;
	const x = (t: number): number => ((t - window.start) / (window.end - window.start)) * W;
	const hits: AxisHit[] = [];

	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, W, height);
	g.textBaseline = 'middle';

	// Week zebra: odd ISO weeks tinted in the week row (three rows) or the minor row (week scale).
	if (three || spec.minor === 'week') {
		const band = three ? layouts.three.weekHit : layout.minorHit;
		g.fillStyle = palette.ink;
		g.globalAlpha = ZEBRA_ALPHA;
		for (const week of unitBoundaries(window, 'week')) {
			if (isoWeek(week.start) % 2 === 1) {
				g.fillRect(x(week.start), band[0], x(week.end) - x(week.start), band[1] - band[0]);
			}
		}
		g.globalAlpha = 1;
	}

	const line = (px: number, y0: number, y1: number, colour: string): void => {
		g.strokeStyle = colour;
		g.beginPath();
		g.moveTo(Math.round(px) + 0.5, y0);
		g.lineTo(Math.round(px) + 0.5, y1);
		g.stroke();
	};
	/**
	 * A period with a note (loop 008 polish, owner 2026-09-20): an accent bar along the top edge
	 * of its cell in its row, the cell's full width clipped to the canvas — labelled or not.
	 */
	const noteBar = (cell: AxisTick, y0: number): void => {
		const x0 = Math.max(0, x(cell.start));
		const x1 = Math.min(W, x(cell.end));
		if (x1 <= x0) return;
		g.fillStyle = palette.accent;
		g.globalAlpha = NOTE_BAR_ALPHA;
		g.fillRect(x0, y0, x1 - x0, NOTE_BAR_PX);
		g.globalAlpha = 1;
	};

	/** Every cell of the row is a hit; the placed labels, the pinned plate, the ghost and the note bars are drawn here. */
	const drawRow = (row: RowLayout): void => {
		g.font = row.font;
		const placed = placeLabels({
			cells: row.cells,
			x,
			measure: (text) => g.measureText(text).width,
			text: (cell, leftmost) => tickLabel(cell.start, cell.unit, context, leftmost)
		});
		const [y0, y1] = row.hit;
		let edge = -Infinity;
		let plateEnd = -Infinity;
		const noted: AxisTick[] = [];
		for (const [index, cell] of row.cells.entries()) {
			const label = placed[index];
			const px = x(cell.start);
			const labelEnd = label.x + label.width + (label.pinned ? LABEL_PADDING_PX / 2 : 0);
			const note = hasNote(cell);
			if (note) noted.push(cell);
			const hit: AxisHit = {
				x0: Math.max(px, edge),
				x1: label.drawn ? Math.max(x(cell.end), labelEnd) : x(cell.end),
				y0,
				y1,
				row: row.row,
				unit: cell.unit,
				start: cell.start,
				end: cell.end,
				label: label.text,
				drawn: label.drawn,
				pinned: label.pinned,
				note
			};
			edge = Math.max(edge, hit.x1);
			hits.push(hit);
			const isSelected = samePeriod(selected, cell);
			if (isSelected) {
				g.fillStyle = palette.accentSubtle;
				g.fillRect(hit.x0, y0, hit.x1 - hit.x0, y1 - y0);
			}
			row.tick(px, cell.labelled);
			if (label.pinned) {
				g.fillStyle = palette.surface;
				g.strokeStyle = palette.border;
				g.beginPath();
				g.roundRect(
					PIN_X_PX + 0.5,
					y0 + PLATE_INSET_PX + 0.5,
					label.width + LABEL_PADDING_PX,
					y1 - y0 - 2 * PLATE_INSET_PX,
					PLATE_RADIUS_PX
				);
				g.fill();
				g.stroke();
				plateEnd = labelEnd;
				g.fillStyle = palette.ink;
				g.fillText(label.text, label.x, row.textY);
				continue;
			}
			if (label.drawn) {
				g.fillStyle = row.ink(cell);
				g.fillText(label.text, label.x, row.textY);
				const underline = row.underline?.(cell, label.width) ?? 0;
				if (underline > 0)
					g.fillRect(label.x, row.underlineY ?? 0, underline, CURRENT_WEEK_UNDERLINE_PX);
				continue;
			}
			// Off the step or left out: the cell says its name under the pointer, and while selected.
			const isHover = samePeriod(hover, cell);
			if (
				(!isHover && !isSelected) ||
				px + LABEL_INSET_PX < Math.max(PIN_X_PX, plateEnd + LABEL_INSET_PX)
			)
				continue;
			g.fillStyle = isSelected ? palette.ink : palette.muted;
			g.globalAlpha = isSelected ? 1 : GHOST_ALPHA;
			g.fillText(label.text, px + LABEL_INSET_PX, row.textY);
			g.globalAlpha = 1;
		}
		// Over the fill, the ticks and the plates: the bar is the top edge of the cell.
		for (const cell of noted) noteBar(cell, y0);
	};

	drawRow({
		row: 'major',
		cells: rows.major,
		font: fonts.major,
		hit: layout.majorHit,
		textY: layout.majorText,
		ink: () => palette.inkSecondary,
		tick: (px, labelled) => {
			if (labelled) line(px, 0, height, palette.borderStrong);
		}
	});

	if (three) {
		const rowLayout = layouts.three;
		const currentWeek = floorUnit(now, 'week');
		// The current week: accent with a short underline (п. 6); the others muted.
		drawRow({
			row: 'week',
			cells: rows.middle,
			font: fonts.week,
			hit: rowLayout.weekHit,
			textY: rowLayout.weekText,
			ink: (cell) => (cell.start === currentWeek ? palette.accent : palette.muted),
			underline: (cell) => (cell.start === currentWeek ? CURRENT_WEEK_UNDERLINE_WIDTH_PX : 0),
			underlineY: rowLayout.weekHit[1] - CURRENT_WEEK_UNDERLINE_PX,
			tick: (px) => line(px, rowLayout.weekHit[0], rowLayout.weekHit[1], palette.border)
		});
	}

	if (spec.minor) {
		const current = floorUnit(now, spec.minor);
		const week = spec.minor === 'week';
		// The current week is accent with a 24 px underline (п. 6); the current day keeps ink with a full one.
		drawRow({
			row: 'minor',
			cells: rows.minor,
			font: fonts.minor,
			hit: layout.minorHit,
			textY: layout.minorText,
			ink: (cell) =>
				cell.start === current ? (week ? palette.accent : palette.ink) : palette.muted,
			underline: (cell, textWidth) =>
				cell.start === current ? (week ? CURRENT_WEEK_UNDERLINE_WIDTH_PX : textWidth) : 0,
			underlineY: layout.minorText + 7,
			// A short tick at every boundary; the stepped cells get the taller one.
			tick: (px, labelled) =>
				line(px, labelled ? layout.minorTick : height - MINOR_TICK_PX, height, palette.border)
		});
	}

	// «Сейчас» marker.
	if (now >= window.start && now <= window.end) {
		const px = Math.round(x(now)) + 0.5;
		g.strokeStyle = palette.accent;
		g.lineWidth = 1;
		g.beginPath();
		g.moveTo(px, layout.minorHit[0]);
		g.lineTo(px, height);
		g.stroke();
		g.fillStyle = palette.accent;
		g.beginPath();
		g.moveTo(px - 4, layout.minorHit[0]);
		g.lineTo(px + 4, layout.minorHit[0]);
		g.lineTo(px, layout.minorHit[0] + 6);
		g.closePath();
		g.fill();
	}

	// Canvas clips to its viewport; the DOM twin must expose the same visible hit areas.
	return {
		band: spec.band,
		hits: hits
			.map((hit) => ({ ...hit, x0: Math.max(0, hit.x0), x1: Math.min(W, hit.x1) }))
			.filter((hit) => hit.x1 > hit.x0)
	};
};

/** The last hit under a point wins; the cells of a row never overlap, so any order is fine. */
export const hitAt = (hits: readonly AxisHit[], px: number, py: number): AxisHit | null => {
	for (let i = hits.length - 1; i >= 0; i -= 1) {
		const hit = hits[i];
		if (px >= hit.x0 && px <= hit.x1 && py >= hit.y0 && py <= hit.y1) return hit;
	}
	return null;
};
