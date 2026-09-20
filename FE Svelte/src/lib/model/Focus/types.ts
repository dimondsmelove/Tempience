import type { LitSet } from '$lib/model/Hover/types';
import type { TimeRange } from '$lib/model/Projection/types';

/**
 * What is open in the Context, as the ribbon keeps it in view (loop 008, A): a
 * record (the ring, its projections and brackets — nothing more lights), a Scope
 * (its records with the subtree), an explicit link (both its ends), a period — a
 * calendar cell or a persisted Period, by its time, and a merged row of the rail
 * (C5: every record of its members, its name in bold).
 */
export type FocusTarget =
	| Readonly<{ kind: 'trace'; traceId: string }>
	| Readonly<{ kind: 'scope'; scopeId: string }>
	| Readonly<{ kind: 'intersection'; intersectionId: string }>
	| Readonly<{ kind: 'period'; range: TimeRange }>
	| Readonly<{ kind: 'row'; rowId: string }>
	| null;

/** The kinds the surface reports in `data-focus`; empty at rest. */
export type FocusKind = 'trace' | 'scope' | 'intersection' | 'period' | 'row' | '';

/**
 * What the focus draws, permanently and under no veil: the lit records in every
 * row they project into, the rows named in bold, and the tinted column of a period.
 */
export type FocusSet = Readonly<LitSet & { range: TimeRange | null }>;
