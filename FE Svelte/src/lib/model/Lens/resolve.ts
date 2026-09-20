import type { LitSet } from '$lib/model/Hover/types';
import type { Mark, ProjectedRow, TimeRange } from '$lib/model/Projection/types';
import { rowOfScope } from '$lib/model/Projection/rows';
import { scopeMembership, scopeTree, subtreeTraceIds } from '$lib/model/Projection/tree';
import type { LensView } from './types';

export const NONE: ReadonlySet<string> = new Set();

/** The rows that draw at least one mark of these records, in rail order: the names that go bold. */
export const rowsHolding = (
	traceIds: ReadonlySet<string>,
	rows: readonly ProjectedRow[]
): ReadonlySet<string> => {
	const rowIds = new Set<string>();
	if (traceIds.size === 0) return rowIds;
	for (const row of rows) {
		if (row.marks.some((mark) => traceIds.has(mark.traceId))) rowIds.add(row.id);
	}
	return rowIds;
};

/**
 * A row by its name (the rail's hover, the merged row's focus — C5): every record it draws,
 * direct and rolled up, and its own name alone; `null` when no row has the id.
 */
export const rowLit = (rowId: string, rows: readonly ProjectedRow[]): LitSet | null => {
	const row = rows.find((candidate) => candidate.id === rowId);
	if (!row) return null;
	return { traceIds: new Set(row.marks.map((mark) => mark.traceId)), rowIds: new Set([row.id]) };
};

/** Every record the rows draw, by id — a record the legend or a filter took off the ribbon lights nowhere. */
export const drawnTraceIds = (rows: readonly ProjectedRow[]): ReadonlySet<string> => {
	const drawn = new Set<string>();
	for (const row of rows) for (const mark of row.marks) drawn.add(mark.traceId);
	return drawn;
};

/**
 * Whether a record's time touches a range, as the Context lists a period's records
 * (`periodContext`) and the header counts the window: the range's end is exclusive, an
 * interval that crosses either boundary is in, a moment on the first day is in.
 */
export const touches = (time: Readonly<Pick<Mark, 'start' | 'end'>>, range: TimeRange): boolean =>
	time.end >= range.start && time.start < range.end;

/** The records the rows draw inside a range, by id. */
export const tracesIn = (range: TimeRange, rows: readonly ProjectedRow[]): ReadonlySet<string> => {
	const ids = new Set<string>();
	for (const row of rows)
		for (const mark of row.marks) if (touches(mark, range)) ids.add(mark.traceId);
	return ids;
};

/**
 * The records of a Scope with its whole subtree, as its row draws them — the direct
 * ones in full force and the subtree as roll-ups (DP8) — limited to what the rows
 * show at all. The tree and the memberships come from the snapshot: a Scope shown
 * through a collapsed parent has no row of its own and still lights its records.
 */
export const scopeTraceIds = (
	scopeId: string,
	rows: readonly ProjectedRow[],
	view: LensView
): ReadonlySet<string> => {
	const tree = scopeTree(view.scopes, view.intersections);
	const membership = scopeMembership(view.traces, view.scopes, view.intersections);
	const subtree = subtreeTraceIds(tree, membership, NONE).get(scopeId);
	if (!subtree?.size) return NONE;
	const drawn = drawnTraceIds(rows);
	return new Set([...subtree].filter((id) => drawn.has(id)));
};

/**
 * The row that stands for a Scope in the rail: its own row or the merged row whose
 * lane holds it, else the row of the nearest ancestor that has one (the Scope draws
 * through it as a roll-up); none when no row shows it.
 */
export const rowStandingFor = (
	scopeId: string,
	rows: readonly ProjectedRow[],
	view: LensView
): string | null => {
	const own = rowOfScope(rows, scopeId);
	if (own) return own.id;
	const tree = scopeTree(view.scopes, view.intersections);
	const seen = new Set<string>([scopeId]);
	let current = tree.parent.get(scopeId);
	while (current && !seen.has(current)) {
		const row = rowOfScope(rows, current);
		if (row) return row.id;
		seen.add(current);
		current = tree.parent.get(current);
	}
	return null;
};

/** The records of a Kind that the rows draw, by id. */
export const kindTraceIds = (
	kindId: string,
	rows: readonly ProjectedRow[],
	view: LensView
): ReadonlySet<string> => {
	const ofKind = new Set(
		view.traces.filter((trace) => trace.kindId === kindId).map((trace) => trace.id)
	);
	if (ofKind.size === 0) return NONE;
	const drawn = drawnTraceIds(rows);
	return new Set([...ofKind].filter((id) => drawn.has(id)));
};
