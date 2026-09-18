import type { FiltersState } from '$lib/state/Filters/Filters.svelte';

export type LegendProps = Readonly<{
	filters: FiltersState;
	/** The Scopes of the timeline, so a hidden one can be named and shown again here. */
	scopes?: readonly Readonly<{ id: string; name: string }>[];
}>;
