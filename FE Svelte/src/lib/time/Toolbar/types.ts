import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

export type Panel = 'rail' | 'context' | 'filters' | 'parked';

export type ToolbarProps = Readonly<{
	workbench: WorkbenchState;
	phone?: boolean;
	/** Panels closed in this layout get an opener button. */
	railOpen: boolean;
	contextOpen: boolean;
	/** The legend strip is shown; the chip collapses and restores it (research п. 17). */
	legendOpen?: boolean;
	ontogglepanel: (panel: Panel, open: boolean) => void;
	ontogglelegend?: () => void;
	/** «Записать»: opens the capture form in the Context. */
	oncapture: () => void;
	/** «Применить N»: writes the accepted proposals (DP18). */
	onapply: () => void;
	/** Import and Apply exist only in a scenario DataSpace. */
	scenarioSpace: boolean;
}>;
