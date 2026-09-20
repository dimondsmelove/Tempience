import type { LitSet } from '$lib/model/Hover/types';
import type { LensView } from '$lib/model/Lens/types';
import { drawnTraceIds, NONE, rowsHolding, rowStandingFor } from '$lib/model/Lens/resolve';
import type { ProjectedRow } from '$lib/model/Projection/types';
import type { PulseTarget } from './types';

/** Nothing pulses: one shared value. */
export const EMPTY_PULSE: LitSet = { traceIds: NONE, rowIds: NONE };

/**
 * Where to look after a Context or history navigation (loop 008, C3): a record rings every
 * projection it has and flashes the names of the rows that hold it; a Scope flashes the name
 * of the row that stands for it, nothing rings; a merged row (C5) flashes its own name the
 * same way; an explicit link does both for each end — a record end rings, a Scope end
 * flashes its row. Limited to what the rows draw.
 */
export const pulseSet = (
	target: PulseTarget | null,
	rows: readonly ProjectedRow[],
	view: LensView
): LitSet => {
	if (!target) return EMPTY_PULSE;
	const drawn = drawnTraceIds(rows);
	const traceIds = new Set<string>();
	const rowIds = new Set<string>();
	const end = (id: string): void => {
		if (drawn.has(id)) traceIds.add(id);
		else if (view.scopes.some((scope) => scope.id === id)) {
			const row = rowStandingFor(id, rows, view);
			if (row) rowIds.add(row);
		}
	};
	switch (target.kind) {
		case 'trace':
			end(target.traceId);
			break;
		case 'scope': {
			const row = rowStandingFor(target.scopeId, rows, view);
			if (row) rowIds.add(row);
			break;
		}
		case 'intersection': {
			const link = view.intersections.find((item) => item.id === target.intersectionId);
			if (link) for (const id of [link.fromId, link.toId]) end(id);
			break;
		}
		case 'row':
			if (rows.some((row) => row.id === target.rowId)) rowIds.add(target.rowId);
			break;
	}
	for (const id of rowsHolding(traceIds, rows)) rowIds.add(id);
	return traceIds.size || rowIds.size ? { traceIds, rowIds } : EMPTY_PULSE;
};
