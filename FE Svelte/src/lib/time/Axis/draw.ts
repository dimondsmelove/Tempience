import type { Locale } from '$lib/state/Locale/types';
import {
	axisRows,
	floorUnit,
	isoWeek,
	nextUnit,
	stickyLabel,
	unitBoundaries
} from '$lib/model/Axis/Axis';
import type { AxisWindow, PeriodRef } from '$lib/model/Axis/types';
import {
	AXIS_FONT_MAJOR,
	AXIS_FONT_MINOR,
	AXIS_FONT_WEEK,
	AXIS_HEIGHT_PX,
	scaledAxisRows,
	STICKY_LEFT_PX,
	STICKY_PADDING_PX,
	ZEBRA_ALPHA
} from './constants';
import type { AxisHit, AxisMetrics, AxisPalette } from './types';

export type DrawAxisInput = Readonly<{
	context: CanvasRenderingContext2D;
	widthPx: number;
	dpr: number;
	window: AxisWindow;
	now: number;
	selected: PeriodRef | null;
	palette: AxisPalette;
	metrics?: AxisMetrics;
	/** Periods with a saved note get a dot after their label. */
	hasNote?: (period: PeriodRef) => boolean;
	/** The language the labels are drawn in. */
	language?: Locale;
}>;

const samePeriod = (a: PeriodRef | null, b: PeriodRef): boolean =>
	a !== null && a.unit === b.unit && a.start === b.start;

/** Draws the axis into the context and returns the clickable label areas. */
export const drawAxis = (input: DrawAxisInput): AxisHit[] => {
	const { context: g, widthPx: W, dpr, window, now, selected, palette } = input;
	const hasNote = input.hasNote ?? (() => false);
	const height = input.metrics?.heightPx ?? AXIS_HEIGHT_PX;
	const language = input.language ?? 'ru';
	const rows = axisRows(window, W, height / AXIS_HEIGHT_PX, language);
	const { spec, ppd } = rows;
	const layouts = scaledAxisRows(height / AXIS_HEIGHT_PX);
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

	const dot = (px: number, py: number): void => {
		g.fillStyle = palette.accent;
		g.beginPath();
		g.arc(px, py, 2.5, 0, Math.PI * 2);
		g.fill();
	};

	// Major row.
	g.font = `${input.metrics?.majorFont ?? AXIS_FONT_MAJOR} ${palette.mono}`;
	for (const [index, tick] of rows.major.entries()) {
		const px = x(tick.start);
		g.strokeStyle = palette.borderStrong;
		g.beginPath();
		g.moveTo(Math.round(px) + 0.5, 0);
		g.lineTo(Math.round(px) + 0.5, height);
		g.stroke();
		const hit = {
			x0: px,
			x1: x(tick.end),
			y0: layout.majorHit[0],
			y1: layout.majorHit[1],
			row: 'major' as const,
			...tick
		};
		if (samePeriod(selected, tick)) {
			g.fillStyle = palette.accentSubtle;
			g.fillRect(hit.x0, hit.y0, hit.x1 - hit.x0, hit.y1 - hit.y0);
		}
		g.fillStyle = palette.inkSecondary;
		const label =
			tick.unit === 'month' && g.measureText(tick.label).width + 12 > hit.x1 - hit.x0
				? tick.label.split(' ')[0]
				: tick.label;
		const tw = g.measureText(label).width;
		const labelEnd = px + 6 + tw + (hasNote(tick) ? 12 : 0);
		const nextLabel = rows.major[index + 1];
		// A label that would run into the next one is left out; its period stays clickable.
		const drawn = !nextLabel || labelEnd + 6 <= x(nextLabel.start);
		// Sparse labels may occupy more than one unlabelled cell; clicks still address their own period.
		if (drawn) hit.x1 = Math.max(hit.x1, labelEnd + 6);
		hits.push(hit);
		if (!drawn) continue;
		g.fillText(label, px + 6, layout.majorText);
		if (hasNote(tick)) dot(px + 6 + tw + 6, layout.majorText);
	}

	// Week row on the day scale.
	if (three) {
		const rowLayout = layouts.three;
		g.font = `${input.metrics?.weekFont ?? AXIS_FONT_WEEK} ${palette.mono}`;
		const currentWeek = floorUnit(now, 'week');
		for (const tick of rows.middle) {
			const px = x(tick.start);
			const tw = g.measureText(tick.label).width;
			const hit = {
				x0: px,
				x1: x(tick.end),
				y0: rowLayout.weekHit[0],
				y1: rowLayout.weekHit[1],
				row: 'week' as const,
				...tick
			};
			hits.push(hit);
			if (samePeriod(selected, tick)) {
				g.fillStyle = palette.accentSubtle;
				g.fillRect(hit.x0, hit.y0, hit.x1 - hit.x0, hit.y1 - hit.y0);
			}
			g.strokeStyle = palette.border;
			g.beginPath();
			g.moveTo(Math.round(px) + 0.5, rowLayout.weekHit[0]);
			g.lineTo(Math.round(px) + 0.5, rowLayout.weekHit[1]);
			g.stroke();
			g.fillStyle = tick.start === currentWeek ? palette.ink : palette.muted;
			g.fillText(tick.label, px + 5, rowLayout.weekText);
			if (hasNote(tick)) dot(px + 5 + tw + 5, rowLayout.weekText);
		}
	}

	// A short tick for every boundary of the minor unit, labelled or not.
	g.strokeStyle = palette.border;
	for (const period of spec.minor ? unitBoundaries(window, spec.minor) : []) {
		const px = Math.round(x(period.start)) + 0.5;
		g.beginPath();
		g.moveTo(px, height - 4);
		g.lineTo(px, height);
		g.stroke();
	}

	// Minor row.
	g.font = `${input.metrics?.minorFont ?? AXIS_FONT_MINOR} ${palette.mono}`;
	const current = spec.minor ? floorUnit(now, spec.minor) : null;
	for (const [index, tick] of rows.minor.entries()) {
		const px = x(tick.start);
		const tw = g.measureText(tick.label).width;
		const hit = {
			x0: px,
			x1: x(tick.end),
			y0: layout.minorHit[0],
			y1: layout.minorHit[1],
			row: 'minor' as const,
			...tick
		};
		if (samePeriod(selected, tick)) {
			g.fillStyle = palette.accentSubtle;
			g.fillRect(hit.x0, hit.y0, hit.x1 - hit.x0, hit.y1 - hit.y0);
		}
		g.strokeStyle = palette.border;
		g.beginPath();
		g.moveTo(Math.round(px) + 0.5, layout.minorTick);
		g.lineTo(Math.round(px) + 0.5, height);
		g.stroke();
		const labelEnd = px + 6 + tw + (hasNote(tick) ? 12 : 0);
		const nextLabel = rows.minor[index + 1];
		const drawn = !nextLabel || labelEnd + 6 <= x(nextLabel.start);
		if (drawn) hit.x1 = Math.max(hit.x1, labelEnd + 6);
		hits.push(hit);
		if (!drawn) continue;
		const isCurrent = tick.start === current;
		g.fillStyle = isCurrent ? palette.ink : palette.muted;
		g.fillText(tick.label, px + 6, layout.minorText);
		if (isCurrent) g.fillRect(px + 6, layout.minorText + 7, tw, 2);
		if (hasNote(tick)) dot(px + 6 + tw + 6, layout.minorText);
	}

	// Sticky plate: the major period under the left edge, hidden when the next boundary is too close.
	const stickyStart = floorUnit(window.start, spec.major);
	const stickyEnd = nextUnit(stickyStart, spec.major);
	const label = stickyLabel(window, spec, ppd, language);
	g.font = `${input.metrics?.majorFont ?? AXIS_FONT_MAJOR} ${palette.mono}`;
	const plateWidth = g.measureText(label).width + STICKY_PADDING_PX * 2;
	const plateHeight = layout.majorHit[1] - layout.majorHit[0];
	if (x(stickyEnd) >= plateWidth + STICKY_LEFT_PX + 4) {
		g.fillStyle = palette.surface;
		g.fillRect(STICKY_LEFT_PX, layout.majorHit[0], plateWidth, plateHeight);
		g.strokeStyle = palette.border;
		g.strokeRect(STICKY_LEFT_PX + 0.5, layout.majorHit[0] + 0.5, plateWidth, plateHeight);
		g.fillStyle = palette.ink;
		g.fillText(label, STICKY_LEFT_PX + STICKY_PADDING_PX, layout.majorText);
		hits.push({
			x0: STICKY_LEFT_PX,
			x1: STICKY_LEFT_PX + plateWidth,
			y0: layout.majorHit[0],
			y1: layout.majorHit[1],
			row: 'sticky',
			unit: spec.major,
			start: stickyStart,
			end: stickyEnd,
			label
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
	return hits
		.map((hit) => ({ ...hit, x0: Math.max(0, hit.x0), x1: Math.min(W, hit.x1) }))
		.filter((hit) => hit.x1 > hit.x0);
};

/** The last hit under a point wins, so the sticky plate beats the label it covers. */
export const hitAt = (hits: readonly AxisHit[], px: number, py: number): AxisHit | null => {
	for (let i = hits.length - 1; i >= 0; i -= 1) {
		const hit = hits[i];
		if (px >= hit.x0 && px <= hit.x1 && py >= hit.y0 && py <= hit.y1) return hit;
	}
	return null;
};
