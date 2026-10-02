import type { RibbonLayout } from '$lib/model/Layout/types';
import type { ProjectedRow } from '$lib/model/Projection/types';
import { ROW_MOVE_CURVE, ROW_MOVE_MIN_PX } from './constants';
import type { Ghost, MotionPlan, MotionRow } from './types';

/**
 * The folded row a child row belongs in, among `rows`: the row standing for its nearest
 * ancestor that has one, when that row stands folded; none when it stands unfolded (the child
 * was simply hidden or shown under it) or no ancestor has a row.
 */
const foldedAncestor = (rows: readonly MotionRow[], row: MotionRow): MotionRow | undefined => {
	for (const ancestorId of row.ancestorIds ?? []) {
		// Its own row first: an unfolded lane holds the ancestor too, but its member row stands for it.
		const holder =
			rows.find((candidate) => candidate.id === ancestorId) ??
			rows.find((candidate) => candidate.scopeIds.includes(ancestorId));
		if (holder) return holder.expanded ? undefined : holder;
	}
	return undefined;
};

/**
 * Where each row of the new order comes from (rows re-ordered by a chapter, its lineup, or
 * nothing): the same row where it stood; a row that is new — the folded rest, or one of its
 * members unfolding — from the topmost old row that shared a Scope with it, else — a child
 * unfolding out of its group — from its parent's folded row. A row with no such origin
 * appears in place.
 */
export const planMotion = (
	previous: readonly MotionRow[],
	next: readonly MotionRow[],
	minPx = ROW_MOVE_MIN_PX
): MotionPlan => {
	const byId = new Map(previous.map((row) => [row.id, row]));
	const byTop = previous.toSorted((a, b) => a.y0 - b.y0);
	const plan = new Map<string, number>();
	for (const row of next) {
		const from =
			byId.get(row.id) ??
			byTop.find((old) => old.scopeIds.some((id) => row.scopeIds.includes(id))) ??
			foldedAncestor(byTop, row);
		if (!from) continue;
		const dy = from.y0 - row.y0;
		if (Math.abs(dy) >= minPx) plan.set(row.id, dy);
	}
	return plan;
};

/**
 * The rows that fold away: each old row no longer there whose Scopes live on in a new row (the
 * merged rest) travels into that row — members slide into the merged row instead of vanishing —
 * and a child row whose group folds travels into its parent's row, the mirror of its unfolding.
 * Unfolding needs no ghost: the rows come out of the row they fold into (`planMotion`).
 */
export const planGhosts = (
	previous: readonly MotionRow[],
	next: readonly MotionRow[],
	minPx = ROW_MOVE_MIN_PX
): Ghost[] => {
	const kept = new Set(next.map((row) => row.id));
	return previous.flatMap((old) => {
		if (kept.has(old.id) || !old.scopeIds.length) return [];
		const into =
			next.find((row) => row.scopeIds.some((id) => old.scopeIds.includes(id))) ??
			foldedAncestor(next, old);
		if (!into) return [];
		const dy = into.y0 - old.y0;
		return Math.abs(dy) >= minPx ? [{ id: old.id, dy, into: into.id }] : [];
	});
};

/**
 * The layout while rows fold into others: each row that takes a fold in is drawn as it stood
 * before, moved to its new place, until the glide ends — the records coming back into it travel
 * there with the folding rows instead of appearing in it at once (owner review of PR #102). Its
 * own glide (`planMotion`) still applies on top. A row that did not stand before is drawn new.
 */
export const holdRows = (
	previous: RibbonLayout,
	next: RibbonLayout,
	ids: ReadonlySet<string>
): RibbonLayout => {
	if (!ids.size) return next;
	const before = new Map(previous.rows.map((row) => [row.row.id, row]));
	return {
		...next,
		rows: next.rows.map((row) => {
			const old = ids.has(row.row.id) ? before.get(row.row.id) : undefined;
			return old ? shiftRow(old, row.y0 - old.y0) : row;
		})
	};
};

/** Each ghost's travel at `progress` (0…1): none at 0, the whole way at 1. */
export const ghostOffsetsAt = (ghosts: readonly Ghost[], progress: number): Map<string, number> => {
	const done = easeRowMove(progress);
	return new Map(ghosts.map((ghost) => [ghost.id, ghost.dy * done]));
};

/** The cubic Bézier easing (0,0)–(x1,y1)–(x2,y2)–(1,1) at progress `p`, as CSS computes it. */
export const cubicBezier =
	([x1, y1, x2, y2]: readonly [number, number, number, number]) =>
	(p: number): number => {
		if (p <= 0) return 0;
		if (p >= 1) return 1;
		const coordinate = (a: number, b: number, t: number): number =>
			3 * a * t * (1 - t) ** 2 + 3 * b * t ** 2 * (1 - t) + t ** 3;
		// Bisection on x(t) = p: monotone for control x in [0, 1].
		let low = 0;
		let high = 1;
		for (let step = 0; step < 40; step += 1) {
			const mid = (low + high) / 2;
			if (coordinate(x1, x2, mid) < p) low = mid;
			else high = mid;
		}
		return coordinate(y1, y2, (low + high) / 2);
	};

/** The glide's easing: the rail's own curve. */
export const easeRowMove = cubicBezier(ROW_MOVE_CURVE);

/** Each moving row's offset at `progress` (0…1): the whole offset at 0, none at 1. */
export const offsetsAt = (plan: MotionPlan, progress: number): Map<string, number> => {
	const left = 1 - easeRowMove(progress);
	return new Map([...plan].map(([id, dy]) => [id, dy * left]));
};

type RowLayout = RibbonLayout['rows'][number];

/** A row with its marks and captions drawn `dy` px lower. */
const shiftRow = (row: RowLayout, dy: number): RowLayout =>
	dy
		? {
				...row,
				y0: row.y0 + dy,
				y1: row.y1 + dy,
				boxes: row.boxes.map((box) => ({ ...box, y0: box.y0 + dy, y1: box.y1 + dy })),
				labels: row.labels.map((label) => ({ ...label, y: label.y + dy }))
			}
		: row;

/** The layout with each moving row, its marks and its captions drawn `offset` px lower. */
export const shiftLayout = (
	layout: RibbonLayout,
	offsets: ReadonlyMap<string, number>
): RibbonLayout => ({
	...layout,
	rows: layout.rows.map((row) => shiftRow(row, offsets.get(row.row.id) ?? 0))
});

/** A projected row as the plan reads it, at `y0`. */
export const motionRow = (row: ProjectedRow, y0: number): MotionRow => ({
	id: row.id,
	scopeIds: row.scopeIds,
	y0,
	...(row.ancestorIds?.length ? { ancestorIds: row.ancestorIds } : {}),
	...(row.expanded ? { expanded: true } : {})
});

/** The rows of a layout as the plan reads them. */
export const motionRows = (layout: RibbonLayout): MotionRow[] =>
	layout.rows.map((row) => motionRow(row.row, row.y0));
