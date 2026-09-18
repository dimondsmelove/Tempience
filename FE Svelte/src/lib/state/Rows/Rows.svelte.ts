/* eslint-disable svelte/prefer-svelte-reactivity -- these sets are immutable values replaced whole (ReadonlySet); reactivity is the reassignment, nothing is changed in place */
import type { RowGrouping } from '$lib/model/Projection/types';

/** Manual disclosure; collapsed groups roll their subtree up (DP8). */
export class RowsState {
	grouping = $state<RowGrouping>('scope');
	expanded = $state<ReadonlySet<string>>(new Set());

	isExpanded(rowId: string): boolean {
		return this.expanded.has(rowId);
	}

	toggle(rowId: string): void {
		const next = new Set(this.expanded);
		if (!next.delete(rowId)) next.add(rowId);
		this.expanded = next;
	}

	expand(rowId: string): void {
		if (!this.expanded.has(rowId)) this.expanded = new Set(this.expanded).add(rowId);
	}

	collapse(rowId: string): void {
		if (!this.expanded.has(rowId)) return;
		const next = new Set(this.expanded);
		next.delete(rowId);
		this.expanded = next;
	}

	collapseAll(): void {
		this.expanded = new Set();
	}
}
