import { axisRows } from '$lib/model/Axis/Axis';
import type { MarkBox } from '$lib/model/Labels/types';
import type { RibbonLayout } from '$lib/model/Layout/types';
import type { TraceLink } from '$lib/model/Projection/types';
import {
	AXIS_BOUNDARY_ALPHA,
	COPY_ALPHA,
	FUTURE_ALPHA,
	LINK_ALPHA,
	LINK_DASH,
	LINK_SAG_PX,
	SCOPE_RANGE_ALPHA
} from './constants';
import { drawMarkBox } from './marks';
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
	showScopeRange: boolean;
}>;

const centreX = (box: MarkBox): number => (box.x0 + box.x1) / 2;

const line = (g: CanvasRenderingContext2D, x: number, y0: number, y1: number): void => {
	const px = Math.round(x) + 0.5;
	g.beginPath();
	g.moveTo(px, y0);
	g.lineTo(px, y1);
	g.stroke();
};

/** Draws the whole ribbon for one layout: rows, ranges, marks, captions, links, «сейчас». */
export const drawRibbon = (input: DrawRibbonInput): void => {
	const { context: g, dpr, layout, palette, metrics, now, selectedTraceId, links } = input;
	const W = layout.widthPx;
	const H = layout.heightPx;
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, W, H);

	// Scope ranges: the border tone at 55 % from the first to the last record of the row.
	if (input.showScopeRange) {
		g.fillStyle = palette.border;
		g.globalAlpha = SCOPE_RANGE_ALPHA;
		for (const row of layout.rows) {
			if (row.rangeX)
				g.fillRect(row.rangeX.x0, row.y0 + 1, row.rangeX.x1 - row.rangeX.x0, row.y1 - row.y0 - 2);
		}
		g.globalAlpha = 1;
	}

	// Boundaries of the top axis row under the data; no grid otherwise (DESIGN.md §6).
	g.strokeStyle = palette.borderStrong;
	g.lineWidth = 1;
	g.globalAlpha = AXIS_BOUNDARY_ALPHA;
	for (const tick of axisRows(layout.window, W).major) line(g, layout.x(tick.start), 0, H);
	g.globalAlpha = 1;

	// Row separators.
	g.strokeStyle = palette.border;
	for (const row of layout.rows) {
		g.beginPath();
		g.moveTo(0, row.y1 - 0.5);
		g.lineTo(W, row.y1 - 0.5);
		g.stroke();
	}

	// Marks: roll-ups under direct records, the selected record's projections on top.
	const selectedBoxes: MarkBox[] = [];
	const boxesByTraceId = new Map<string, MarkBox[]>();
	for (const row of layout.rows) {
		for (const box of row.boxes) {
			(boxesByTraceId.get(box.mark.traceId) ??
				boxesByTraceId.set(box.mark.traceId, []).get(box.mark.traceId))!.push(box);
			if (box.x1 < 0 || box.x0 > W) continue;
			if (box.mark.traceId === selectedTraceId) selectedBoxes.push(box);
			else if (box.mark.rollup) drawMarkBox(g, box, palette, false);
		}
		for (const box of row.boxes) {
			if (box.x1 < 0 || box.x0 > W || box.mark.rollup || box.mark.traceId === selectedTraceId)
				continue;
			drawMarkBox(g, box, palette, false);
		}
	}

	if (selectedTraceId) {
		// Explicit links of the selected record: arcs under the marks; the arc alone says enough (owner, 2026-09-15).
		g.save();
		g.strokeStyle = palette.accent;
		g.fillStyle = palette.accent;
		g.lineWidth = 1;
		g.globalAlpha = LINK_ALPHA;
		for (const link of links) {
			const outgoing = link.fromTraceId === selectedTraceId;
			if (!outgoing && link.toTraceId !== selectedTraceId) continue;
			const from = boxesByTraceId.get(selectedTraceId)?.[0];
			const to = boxesByTraceId.get(outgoing ? link.toTraceId : link.fromTraceId)?.[0];
			if (!from || !to) continue;
			const x0 = centreX(from),
				x1 = centreX(to);
			const base = Math.max(from.y1, to.y1);
			g.setLineDash([]);
			g.beginPath();
			g.moveTo(x0, from.y1);
			g.quadraticCurveTo((x0 + x1) / 2, base + LINK_SAG_PX, x1, to.y1);
			g.stroke();
		}
		// Copies of the selected record: a dashed line between its projections.
		const copies = (boxesByTraceId.get(selectedTraceId) ?? []).slice().sort((a, b) => a.y0 - b.y0);
		if (copies.length > 1) {
			g.globalAlpha = COPY_ALPHA;
			g.setLineDash([...LINK_DASH]);
			g.beginPath();
			g.moveTo(centreX(copies[0]), (copies[0].y0 + copies[0].y1) / 2);
			for (const box of copies.slice(1)) g.lineTo(centreX(box), (box.y0 + box.y1) / 2);
			g.stroke();
		}
		g.restore();
		for (const box of selectedBoxes) drawMarkBox(g, box, palette, true);
	}

	// Captions: 12/400 ink-secondary, the selected one 12/600 ink.
	g.textBaseline = 'top';
	const regular = `${metrics.captionPx}px ${palette.sans}`;
	const strong = `600 ${metrics.captionPx}px ${palette.sans}`;
	for (const row of layout.rows) {
		for (const label of row.labels) {
			g.font = label.selected ? strong : regular;
			g.fillStyle = label.selected ? palette.ink : palette.inkSecondary;
			g.fillText(label.text, label.x, label.y);
		}
	}

	// The future is darkened, then «сейчас» is drawn on top.
	const nowX = layout.x(now);
	if (nowX < W) {
		g.save();
		g.globalCompositeOperation = 'multiply';
		g.globalAlpha = FUTURE_ALPHA;
		g.fillStyle = palette.muted;
		g.fillRect(Math.max(0, nowX), 0, W - Math.max(0, nowX), H);
		g.restore();
	}
	if (nowX >= 0 && nowX <= W) {
		g.strokeStyle = palette.accent;
		g.lineWidth = 1;
		line(g, nowX, 0, H);
	}
};
