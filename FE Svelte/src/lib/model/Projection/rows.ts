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
