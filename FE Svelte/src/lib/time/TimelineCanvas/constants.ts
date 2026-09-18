/** Alphas from DESIGN.md §5: marks overlay at 0.55, roll-ups at 0.25. */
export const MARK_ALPHA = 0.55;
export const ROLLUP_ALPHA = 0.25;
/** Interval fill is 45 % of the mark tone; its 1 px frame is the full tone. */
export const INTERVAL_FILL_RATIO = 0.45;
export const SELECTED_INTENT_FILL_ALPHA = 0.25;
/** The fill of a closed intention, as a share of the mark's own alpha. */
export const CLOSED_INTENT_FILL_ALPHA = 0.6;
/** Scope range is the border colour at 55 % (DESIGN.md §2). */
export const SCOPE_RANGE_ALPHA = 0.55;
/** The future is darkened by multiplying the muted tone at this alpha; works in both themes. */
export const FUTURE_ALPHA = 0.22;
export const AXIS_BOUNDARY_ALPHA = 0.6;
export const LINK_ALPHA = 0.75;
export const COPY_ALPHA = 0.6;
export const MARK_RADIUS_PX = 2;
/** Proposals: a hollow silhouette with a short amber dash (DESIGN.md §5). */
export const PROPOSAL_DASH = [3, 2] as const;
export const FUZZY_DASH: readonly number[] = [4, 3];
export const LINK_DASH: readonly number[] = [3, 3];
/** Arcs of explicit links bow this far below the marks. */
export const LINK_SAG_PX = 22;
export const LINK_DOT_RADIUS_PX = 2.5;
/** The DOM twin lists at most this many visible records. */
export const TWIN_LIMIT = 300;
