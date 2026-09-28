import type { DemoStoryEntry } from '$lib/scenarios/demo/registry';

export type FirstGroupProps = {
	/** Creates the first Scope and finishes setup. */
	oncreate: (name: string) => Promise<void>;
	/** Finishes setup without a Scope; records can be kept without one. */
	onskip: () => void;
	/** Opens one story of the demo catalog instead; without it no catalog is shown. */
	ondemo?: (entry: DemoStoryEntry) => void;
};
