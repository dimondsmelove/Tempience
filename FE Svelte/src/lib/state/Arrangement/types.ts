import type { RowArrangement } from '$lib/model/Arrangement/types';

/**
 * Where the arrangement lives: the device settings (`DeviceAppearance.rowArrangement`),
 * read and written as `railOpen` / `legendOpen` are. `null` is the default order.
 */
export type ArrangementStore = Readonly<{
	read: () => RowArrangement | null;
	write: (next: RowArrangement | null) => void;
}>;

/**
 * What the rail or its «⋯» menu did to the arrangement, as the toast names it (Q4-A):
 * `collapse` is «Схлопнуть всё», `splitAll` «Разделить всё», `reset` «Сбросить порядок» (C3),
 * `unclaim` «↩» — a claimed child returned to its parent (review 2026-09-19, п. 32).
 */
export type ArrangementChange =
	'merge' | 'reorder' | 'split' | 'unclaim' | 'rename' | 'collapse' | 'splitAll' | 'reset';

/** One level of undo: the arrangement before the change (`null`: the default order) and what the change was. */
export type ArrangementUndo = Readonly<{
	previous: RowArrangement | null;
	change: ArrangementChange;
	/** The lane the change produced or touched, for its name in the toast: a merge's target, a rename's lane. */
	laneIndex: number | null;
}>;
