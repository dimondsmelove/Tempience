import type { ProjectedRow } from '$lib/model/Projection/types';
import type { ArrangementState } from '$lib/state/Arrangement/Arrangement.svelte';
import type { FiltersState } from '$lib/state/Filters/Filters.svelte';
import type { RowsState } from '$lib/state/Rows/Rows.svelte';

/**
 * What a rail row is to the drag (loop 006 C2): a lane — `band` is its place among the lane
 * rows shown, `lane` its index in the arrangement — or a child Scope shown under its unfolded
 * parent, which is no lane (`band` and `lane` null) and is claimed by the drop (D).
 */
export type DragSource = Readonly<{
	rowId: string;
	band: number | null;
	lane: number | null;
	scopeId: string | null;
}>;

/** What a merged row's name needs beyond the row (Q1-A): the auto-name, the owner's name, the members by name. */
export type MergedRowInfo = Readonly<{
	autoName: string;
	ownerName: string | null;
	composition: string;
}>;

/** The «⋯» menu of the rail header (C3): the actions on the whole arrangement. */
export type RailMenuProps = Readonly<{ arrangement: ArrangementState }>;

/** One row of the rail: the row itself and what the rail knows about its place in the gesture. */
export type RailRowProps = Readonly<{
	row: ProjectedRow;
	filters: FiltersState;
	disclosure: RowsState;
	rowHeightPx: number;
	onCanvas: boolean;
	searching: boolean;
	/**
	 * The rail is in Scope grouping with an arrangement and this row can be dragged: the row has
	 * a grip and is a drag handle. A member row under an unfolded merged row is not (C5): the lane
	 * is the unit.
	 */
	arrangeable: boolean;
	/** The row's place among the lane rows shown; absent on a child row. */
	band: number | undefined;
	/** The selected Scope, the «Без Scope» row's own id when that row is selected, or the merged row's id (C5). */
	selectedRowId: string | null;
	lit: boolean;
	/** The row is the dragged one (dimmed), or the one the pointer would merge into (tinted). */
	drop: 'source' | 'merge' | null;
	/** The lens veil is on and this row holds nothing the lens names: it fades to `1 − veil` (loop 008, B). */
	veiled: boolean;
	/** The veil's strength 0–1 on this device. */
	veil: number;
	/** «Куда смотреть» (loop 008, C3): the row's name flashes once after a Context or history navigation. */
	pulse: boolean;
	/** Set on a merged row of the rail itself: its name renames, «×» splits. */
	merged: MergedRowInfo | null;
	/** A claimed child placed alone as a lane (C2, D): «↩» returns it under its parent (review п. 32). */
	claimed: boolean;
	onhover: (event: PointerEvent) => void;
	onpress: (event: PointerEvent) => void;
	onselect: (scopeId: string) => void;
	/** The merged row's name chosen (C5): its Context. */
	onselectrow: () => void;
	/** The merged row's chevron (C5): its member rows beneath it, or folded away. */
	ontoggle: () => void;
	onrename: (name: string | null) => void;
	onsplit: () => void;
	onunclaim: () => void;
}>;

export type ScopeRailProps = Readonly<{
	rows: readonly ProjectedRow[];
	filters: FiltersState;
	disclosure: RowsState;
	/** The lanes the rows come from and the actions of the drag, «×», «↩» and the rename (C2); absent, the rows are not arranged. */
	arrangement?: ArrangementState;
	/** Every Scope's name and «Без Scope», for the full composition of a merged row (Q1-A). */
	scopesById?: ReadonlyMap<string, Readonly<{ name: string }>>;
	headerHeight?: number;
	/** Height of every row, shared with the canvas (C9a-2). */
	rowHeightPx: number;
	widthPx: number;
	compact: boolean;
	onCanvas?: boolean;
	/** The selected Scope, the «Без Scope» row's own id when that row is selected, or the merged row's id (C5). */
	selectedRowId: string | null;
	/** Rows whose names go bold: the hovered record's Scopes, or the hovered row itself (п. 5), and the focus's (loop 008). */
	litRowIds?: ReadonlySet<string>;
	/** The rows the lens names while something is hovered; `null` when nothing is — then no row is veiled (loop 008, B). */
	lensRowIds?: ReadonlySet<string> | null;
	/** The lens veil's strength 0–1 on this device; 0 veils no row. */
	veil?: number;
	/** The rows whose names flash once after a Context or history navigation (loop 008, C3). */
	pulseRowIds?: ReadonlySet<string>;
	/** The pointer rests on a row's name, or on none; touch never hovers. */
	onhoverrow?: (rowId: string | null) => void;
	onselectscope: (scopeId: string) => void;
	/** A merged row chosen by its name (C5): its id and the members of the lane behind it. */
	onselectrow?: (rowId: string, members: readonly string[]) => void;
	/** A new root Scope from the rail itself; absent on the canvas twin. */
	oncreate?: () => void;
	onclose: () => void;
	onpreview: (value: number) => void;
	oncommit: () => void;
	oncancel: () => void;
}>;
