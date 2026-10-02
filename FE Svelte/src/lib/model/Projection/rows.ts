import { MERGED_ROW_ID_JOINER } from '$lib/model/Arrangement/constants';
import type { ProjectedRow } from './types';

/**
 * The row that stands for a Scope, or for the «Без Scope» row id: its own row — a member
 * row under an unfolded merged row included (C5) — else the merged row whose lane holds it
 * (research п. 7). A Scope shown through a collapsed parent has no row of its own and gives
 * nothing — as before the arrangement, when the rail could not scroll to it either.
 */
export const rowOfScope = (
	rows: readonly ProjectedRow[],
	scopeId: string
): ProjectedRow | undefined =>
	rows.find((row) => row.id === scopeId) ??
	rows.find((row) => row.kind === 'merged' && row.id.split(MERGED_ROW_ID_JOINER).includes(scopeId));

/**
 * A row with the rows standing under it: an unfolded merged row (C5) and its member rows, theirs
 * too — the lane whole, its records wherever they stand now that the members draw their own
 * (owner 2026-10-02); any other row is itself alone. Empty when no row has the id.
 */
export const rowBlock = (rows: readonly ProjectedRow[], rowId: string): ProjectedRow[] => {
	const index = rows.findIndex((row) => row.id === rowId);
	if (index < 0) return [];
	const row = rows[index];
	const block = [row];
	if (row.kind !== 'merged' || !row.expanded) return block;
	for (const next of rows.slice(index + 1)) {
		if (next.depth <= row.depth) break;
		block.push(next);
	}
	return block;
};
