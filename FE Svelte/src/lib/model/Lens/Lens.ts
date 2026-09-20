import type { HoverTarget } from '$lib/model/Hover/types';
import type { Mark, ProjectedRow, TraceLink } from '$lib/model/Projection/types';
import {
	drawnTraceIds,
	kindTraceIds,
	NONE,
	rowLit,
	rowsHolding,
	rowStandingFor,
	scopeTraceIds,
	tracesIn
} from './resolve';
import type { LensSet, LensView } from './types';

/** Nothing under the lens: one shared value, so a cleared hover does not read as a change. */
export const EMPTY_LENS: LensSet = { traceIds: NONE, rowIds: NONE, range: null };

/** The records an explicit link ties to this one, in either direction (`TraceLink`), that the rows draw. */
export const linkedTo = (
	traceId: string,
	links: readonly TraceLink[],
	drawn: ReadonlySet<string>
): ReadonlySet<string> => {
	const ids = new Set<string>();
	for (const link of links) {
		const other =
			link.fromTraceId === traceId
				? link.toTraceId
				: link.toTraceId === traceId
					? link.fromTraceId
					: null;
		if (other && other !== traceId && drawn.has(other)) ids.add(other);
	}
	return ids;
};

/**
 * Resolves a hover into what the lens draws above the veil (loop 008, B).
 * Over a record: the record in every row it projects into plus the records
 * with an explicit link to it, both directions; the rail names in bold every
 * row that holds one of them. Over a row's name in the rail: every record the
 * row draws, direct and rolled up, wherever else it is projected; only the
 * hovered row's own name stays above the veil, even a row holding a projection
 * of a lit record goes under it. Over a Scope: its records with the subtree, as
 * its row draws them, and the name of the row that stands for it. Over a period:
 * its column and the records in it. Over an explicit set or a Kind: those
 * records; the rows holding them named. Pure over the projection, so a hover
 * costs one redraw and no layout.
 */
export const lensSet = (
	hover: HoverTarget,
	rows: readonly ProjectedRow[],
	links: readonly TraceLink[],
	view: LensView
): LensSet => {
	if (!hover) return EMPTY_LENS;
	switch (hover.kind) {
		case 'trace': {
			const drawn = drawnTraceIds(rows);
			if (!drawn.has(hover.traceId)) return EMPTY_LENS;
			const traceIds = new Set([hover.traceId, ...linkedTo(hover.traceId, links, drawn)]);
			return { traceIds, rowIds: rowsHolding(traceIds, rows), range: null };
		}
		case 'row': {
			const lit = rowLit(hover.rowId, rows);
			return lit ? { ...lit, range: null } : EMPTY_LENS;
		}
		case 'scope': {
			const traceIds = scopeTraceIds(hover.scopeId, rows, view);
			const rowId = rowStandingFor(hover.scopeId, rows, view);
			return { traceIds, rowIds: rowId ? new Set([rowId]) : NONE, range: null };
		}
		case 'period': {
			const range = { start: hover.period.start, end: hover.period.end };
			const traceIds = tracesIn(range, rows);
			return { traceIds, rowIds: rowsHolding(traceIds, rows), range };
		}
		case 'traces': {
			const drawn = drawnTraceIds(rows);
			const traceIds = new Set(hover.traceIds.filter((id) => drawn.has(id)));
			return { traceIds, rowIds: rowsHolding(traceIds, rows), range: null };
		}
		case 'kind': {
			const traceIds = kindTraceIds(hover.kindId, rows, view);
			return { traceIds, rowIds: rowsHolding(traceIds, rows), range: null };
		}
	}
};

/**
 * Whether a mark stays under the veil: for a row hover everything outside the row;
 * for every other kind every mark of a record the lens does not light. Read by the
 * drawing for what it paints again above the veil and by the twin for `data-veiled`.
 */
export const underVeil = (
	hover: HoverTarget,
	lens: LensSet,
	mark: Pick<Mark, 'traceId' | 'rowId'>
): boolean =>
	hover?.kind === 'row' ? mark.rowId !== hover.rowId : !lens.traceIds.has(mark.traceId);
