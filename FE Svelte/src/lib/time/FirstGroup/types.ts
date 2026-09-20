export type FirstGroupProps = {
	/** Creates the first Scope and finishes setup. */
	oncreate: (name: string) => Promise<void>;
	/** Finishes setup without a Scope; records can be kept without one. */
	onskip: () => void;
	/** Opens the demo space (Watson's notebook) instead; without it no demo link is shown. */
	ondemo?: () => void;
};
