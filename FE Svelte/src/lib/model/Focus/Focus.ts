import type { LitSet } from '$lib/model/Hover/types';
import type { LensView } from '$lib/model/Lens/types';
import {
	drawnTraceIds,
	NONE,
	rowLit,
	rowsHolding,
	rowStandingFor,
	scopeTraceIds,
	tracesIn
} from '$lib/model/Lens/resolve';
import type { ProjectedRow } from '$lib/model/Projection/types';
import type { FocusSet, FocusTarget } from './types';

/** Nothing in focus: one shared value. */
export const EMPTY_FOCUS: FocusSet = { traceIds: NONE, rowIds: NONE, range: null };

/**
 * Resolves what the Context shows into what the ribbon keeps lit (loop 008, A).
 * A period — a calendar cell or a persisted Period — tints its column and lights
 * every record whose time touches it, in every row it projects into; a Scope
 * lights its records with the subtree, as its row draws them, and names that row;
 * a merged row (C5) lights every record it draws — its members' — and names itself;
 * an explicit link lights both its ends (a Scope end by its records); a record
 * lights nothing beyond what its selection already draws — the ring, the
 * projections and the brackets are the selection's own.
 */
export const focusSet = (
	focus: FocusTarget,
	rows: readonly ProjectedRow[],
	view: LensView
): FocusSet => {
	if (!focus) return EMPTY_FOCUS;
	switch (focus.kind) {
		case 'trace':
			return EMPTY_FOCUS;
		case 'scope': {
			const traceIds = scopeTraceIds(focus.scopeId, rows, view);
			const rowId = rowStandingFor(focus.scopeId, rows, view);
			return { traceIds, rowIds: rowId ? new Set([rowId]) : NONE, range: null };
		}
		case 'intersection': {
			const link = view.intersections.find((item) => item.id === focus.intersectionId);
			if (!link) return EMPTY_FOCUS;
			const drawn = drawnTraceIds(rows);
			const traceIds = new Set<string>();
			for (const end of [link.fromId, link.toId]) {
				if (drawn.has(end)) traceIds.add(end);
				else if (view.scopes.some((scope) => scope.id === end))
					for (const id of scopeTraceIds(end, rows, view)) traceIds.add(id);
			}
			return { traceIds, rowIds: rowsHolding(traceIds, rows), range: null };
		}
		case 'period': {
			const traceIds = tracesIn(focus.range, rows);
			return { traceIds, rowIds: rowsHolding(traceIds, rows), range: focus.range };
		}
		case 'row': {
			const lit = rowLit(focus.rowId, rows);
			return lit ? { ...lit, range: null } : EMPTY_FOCUS;
		}
	}
};

/** The focus and the lens as one: what draws in full force and whose names go bold. */
export const unionLit = (a: LitSet, b: LitSet): LitSet => {
	if (a.traceIds.size === 0 && a.rowIds.size === 0) return b;
	if (b.traceIds.size === 0 && b.rowIds.size === 0) return a;
	return {
		traceIds: new Set([...a.traceIds, ...b.traceIds]),
		rowIds: new Set([...a.rowIds, ...b.rowIds])
	};
};
