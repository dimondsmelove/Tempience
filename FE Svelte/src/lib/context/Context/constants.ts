/**
 * Parts of a record's Context: foldable sections in one scroll at every width (C9a-1; the
 * compact tabs went on 2026-10-02 — reading and following a link must not need a switch).
 */
export const CONTEXT_TABS = [
	{ id: 'overview', label: 'context.tabOverview' },
	/** Only records that have one — intentions — offer this part. */
	{ id: 'result', label: 'context.tabResult' },
	{ id: 'links', label: 'context.tabLinks' },
	{ id: 'neighborhood', label: 'context.tabNeighborhood' },
	/** The record's own journal: what happened to it and to what it names. */
	{ id: 'history', label: 'context.tabHistory' },
	/** Ids, origin, placement and raw data: last, folded like any other part. */
	{ id: 'tech', label: 'overview.technical' }
] as const;

export type ContextTab = (typeof CONTEXT_TABS)[number]['id'];

/** Which desktop sections are collapsed; everything is open until the user folds it. */
export const SECTIONS_STORAGE_KEY = 'tempience.context.sections.v1';
