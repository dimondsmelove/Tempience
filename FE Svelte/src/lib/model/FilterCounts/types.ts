/** `n · Σ m` of one Scope: its direct records and its whole subtree, as the rail row counts them. */
export type ScopeCounts = Readonly<{ direct: number; subtree: number }>;

/** The numbers beside the items of the «Фильтры» popover (loop 008, C7). */
export type FilterCounts = Readonly<{
	/** Records of each Trace Kind in the view, by Kind id, each record once — whatever the window and the filters. */
	kinds: ReadonlyMap<string, number>;
	/** What each hidden Scope's rail row would count once the Scope is shown again, the other filters as they stand. */
	hiddenScopes: ReadonlyMap<string, ScopeCounts>;
}>;
