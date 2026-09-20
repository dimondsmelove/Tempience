import type { LegendKey } from '$lib/model/Legend/types';
import type { FiltersState } from '$lib/state/Filters/Filters.svelte';

export type LegendProps = Readonly<{
	filters: FiltersState;
	/** Kinds at least one mark of the current view answers to, before the legend filter (`Projection.legendKeys`). */
	present: ReadonlySet<LegendKey>;
	/** The element id the toolbar's «Легенда» toggle controls. */
	id?: string;
	/** Collapsed by the toggle: the strip stays in the DOM for `aria-controls`, but is not shown. */
	hidden?: boolean;
}>;
