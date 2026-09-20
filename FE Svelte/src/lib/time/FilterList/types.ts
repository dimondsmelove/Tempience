import type { FilterCounts } from '$lib/model/FilterCounts/types';
import type { FiltersState } from '$lib/state/Filters/Filters.svelte';
import type { ChipScope } from '$lib/ui/ScopeChip/types';

export type FilterListProps = Readonly<{
	filters: FiltersState;
	/** The number beside each item: a Kind's records, a hidden Scope's `n · Σ m` (C7). */
	counts: FilterCounts;
	/** The Scopes of the timeline, so a hidden one can be named in its colour and shown again here. */
	scopes?: readonly ChipScope[];
}>;
