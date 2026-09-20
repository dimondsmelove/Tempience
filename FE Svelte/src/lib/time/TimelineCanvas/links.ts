import { closingGeometry } from '$lib/model/ClosingMark/ClosingMark';
import { CLOSING_LINE_ALPHA } from '$lib/model/ClosingMark/constants';
import type { Caption, MarkBox } from '$lib/model/Labels/types';
import { LINK_TICK_HEIGHT_PX, LINK_TICK_WIDTH_PX } from '$lib/model/LinkBracket/constants';
import { linkBracket, nearestProjection } from '$lib/model/LinkBracket/LinkBracket';
import type { BracketAnchor } from '$lib/model/LinkBracket/types';
import { CAPSULE_RADIUS_PX, CLOSED_GAP_TONE } from '$lib/model/MarkStyle/constants';
import { markExtent, markStyle } from '$lib/model/MarkStyle/MarkStyle';
import type { MarkStyle } from '$lib/model/MarkStyle/types';
import type { TraceLink } from '$lib/model/Projection/types';
import { LINK_ALPHA, PROJECTION_ALPHA, PROJECTION_DASH } from './constants';
import { line } from './ground';
import { paintWoven } from './marks';
import type { CanvasPalette } from './types';

/** A mark box with the row it stands in and the colours it paints with (the row's, or its own in a merged row). */
export type Placed = Readonly<{
	box: MarkBox;
	rowIndex: number;
	rowCentreY: number;
	colours: readonly string[];
}>;

/** Where a bracket meets a placed mark: the anchor of its drawn silhouette. */
const anchorOf = (placed: Placed, selectedTraceId: string | null): BracketAnchor => {
	const style = markStyle(placed.box.mark, {
		selected: placed.box.mark.traceId === selectedTraceId
	});
	const extent = markExtent(placed.box, style, placed.colours.length > 1);
	return {
		x: extent.anchorX,
		y0: placed.box.y0,
		y1: placed.box.y1,
		rowIndex: placed.rowIndex,
		rowCentreY: placed.rowCentreY
	};
};

/**
 * The dashed accent connector between the projections of one record across rows,
 * at its start (п. 4): the selected record's own.
 */
export const drawProjections = (
	g: CanvasRenderingContext2D,
	projections: readonly Placed[],
	palette: CanvasPalette,
	selectedTraceId: string | null
): void => {
	if (projections.length < 2) return;
	const top = anchorOf(projections[0], selectedTraceId);
	const bottom = anchorOf(projections[projections.length - 1], selectedTraceId);
	g.save();
	g.strokeStyle = palette.accent;
	g.lineWidth = 1;
	g.globalAlpha = PROJECTION_ALPHA;
	g.setLineDash([...PROJECTION_DASH]);
	line(g, top.x, (top.y0 + top.y1) / 2, (bottom.y0 + bottom.y1) / 2);
	g.restore();
};

/**
 * The explicit links of one record as solid ink brackets through a channel under its
 * row (п. 15), from its first projection to the nearest projection of each linked
 * record, in either direction. Drawn for the selected record, and again above the
 * veil for the hovered one (loop 008, B) — the same brackets.
 */
export const drawBrackets = (
	g: CanvasRenderingContext2D,
	traceId: string,
	placedByTraceId: ReadonlyMap<string, readonly Placed[]>,
	links: readonly TraceLink[],
	palette: CanvasPalette,
	selectedTraceId: string | null
): void => {
	const trunk = placedByTraceId.get(traceId)?.[0];
	if (!trunk) return;
	g.save();
	g.strokeStyle = palette.ink;
	g.fillStyle = palette.ink;
	g.lineWidth = 1;
	g.globalAlpha = LINK_ALPHA;
	const from = anchorOf(trunk, selectedTraceId);
	for (const link of links) {
		const outgoing: boolean = link.fromTraceId === traceId;
		if (!outgoing && link.toTraceId !== traceId) continue;
		const otherId: string = outgoing ? link.toTraceId : link.fromTraceId;
		if (otherId === traceId) continue;
		const target = nearestProjection(placedByTraceId.get(otherId), trunk.rowIndex);
		if (!target) continue;
		const bracket = linkBracket(from, anchorOf(target, selectedTraceId));
		g.beginPath();
		bracket.points.forEach((point, index) =>
			index === 0 ? g.moveTo(point.x, point.y) : g.lineTo(point.x, point.y)
		);
		g.stroke();
		g.fillRect(bracket.tick.x, bracket.tick.y, LINK_TICK_WIDTH_PX, LINK_TICK_HEIGHT_PX);
	}
	g.restore();
};

/**
 * Where a closed intention was closed (loop 008, C4), drawn with the mark whenever its
 * caption is forced — selected, lit or matched — in the same pass as its ring: the marker at
 * `closedX`, a capsule of the mark's colours at 45 % under the mark's own alpha, and the
 * hairline of ink at 0.5 from the mark to it, cut around the row's captions. The canvas clips
 * a marker past its edge; the line runs to the edge.
 */
export const drawClosing = (
	g: CanvasRenderingContext2D,
	placed: Placed,
	style: MarkStyle,
	closedX: number,
	widthPx: number,
	captions: readonly Caption[],
	palette: CanvasPalette
): void => {
	const extent = markExtent(placed.box, style, placed.colours.length > 1);
	const closing = closingGeometry(
		extent,
		placed.box,
		closedX,
		widthPx,
		captions.map((caption) => caption.label)
	);
	g.save();
	g.strokeStyle = palette.ink;
	g.lineWidth = 1;
	g.globalAlpha = CLOSING_LINE_ALPHA;
	for (const segment of closing.segments) {
		g.beginPath();
		g.moveTo(segment.x0, closing.lineY);
		g.lineTo(segment.x1, closing.lineY);
		g.stroke();
	}
	g.globalAlpha = style.alpha * CLOSED_GAP_TONE;
	paintWoven(g, placed.colours, 'layers', closing.marker, CAPSULE_RADIUS_PX);
	g.restore();
};
