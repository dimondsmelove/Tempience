/**
 * One row of the ribbon as the owner arranged it (research 2026-09-18, п. 7;
 * loop 006, Q1–Q3): a set of Scopes. A lane with one member is a plain row; a
 * lane with several is a merged row that shows the records of all of them,
 * deduplicated by traceId. The «Без Scope» row takes part under its row id.
 */
export type RowLane = Readonly<{
	/** Scope ids (or the «Без Scope» row id), in the order their dots show. */
	members: readonly string[];
	/** The owner's name for a merged lane; the auto-name «X +N» otherwise (Q1-A). */
	name?: string;
	/**
	 * A merged lane unfolded (loop 008, C5): its member rows stand beneath the merged row.
	 * View state kept with the arrangement on the device; never set on a lane of one member.
	 */
	expanded?: boolean;
}>;

/**
 * The order and the sets of the rows: a view setting of this device, never
 * data (Q3-A). `null` in the device settings means the default order — the
 * Scope tree as it is.
 */
export type RowArrangement = Readonly<{ lanes: readonly RowLane[] }>;

/** What `reconcile` measures a saved arrangement against. */
export type LaneIds = Readonly<{
	/** The ids of the default lanes, in the default order: root Scopes, then «Без Scope». */
	defaults: readonly string[];
	/** Every id that may be a member: all Scopes, root or not, and «Без Scope». */
	known: ReadonlySet<string>;
}>;

/**
 * Where a dragged row lands (research «Открытые вопросы» п. 1, loop 006 C2): on a lane, to
 * merge into it, or between lanes, to be inserted there. `index` is a lane index for `merge`
 * and an insertion point `0..lanes.length` for `insert`. The rail resolves the pointer to one
 * of these (`model/RailDrag`) and the arrangement applies it (`merge`, `reorder`, `claim`).
 */
export type DropTarget = Readonly<
	{ kind: 'merge'; index: number } | { kind: 'insert'; index: number }
>;
