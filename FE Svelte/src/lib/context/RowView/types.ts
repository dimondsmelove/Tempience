import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

export type RowViewProps = Readonly<{
	workbench: WorkbenchState;
	/** The merged row chosen, by its row id. */
	rowId: string;
}>;
