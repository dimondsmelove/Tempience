import type { ProjectedRow } from '$lib/model/Projection/types';
import type { FiltersState } from '$lib/state/Filters/Filters.svelte';
import type { RowsState } from '$lib/state/Rows/Rows.svelte';

export type ScopeRailProps = Readonly<{
	rows: readonly ProjectedRow[];
	filters: FiltersState;
	disclosure: RowsState;
	headerHeight?: number;
	/** Height of every row, shared with the canvas (C9a-2). */
	rowHeightPx: number;
	widthPx: number;
	compact: boolean;
	onCanvas?: boolean;
	/** The selected Scope, or the «Без Scope» row's own id when that row is selected. */
	selectedScopeId: string | null;
	onselectscope: (scopeId: string) => void;
	/** A new root Scope from the rail itself; absent on the canvas twin. */
	oncreate?: () => void;
	onclose: () => void;
	onpreview: (value: number) => void;
	oncommit: () => void;
	oncancel: () => void;
}>;
