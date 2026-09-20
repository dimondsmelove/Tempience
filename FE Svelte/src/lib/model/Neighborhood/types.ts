import type { MarkTime } from '$lib/model/Projection/types';
import type { IntersectionKind } from '$lib/state/triplit/types';

export type NeighborLinkKind = IntersectionKind | 'trace_ref' | 'temporal_anchor';

/** Why a record sits next to the anchor (DESIGN.md §8, «Окрестность»). */
export type NeighborReason =
	| Readonly<{ kind: 'link'; link: NeighborLinkKind; direction: 'outgoing' | 'incoming' }>
	| Readonly<{ kind: 'sameDay' }>
	| Readonly<{ kind: 'distance'; days: number }>
	| Readonly<{ kind: 'sharedScope'; scopeIds: readonly string[] }>
	| Readonly<{ kind: 'sharedSource'; sourceId: string }>;

export type Neighbor = Readonly<{
	traceId: string;
	label: string;
	time: MarkTime | null;
	/**
	 * Every Scope the record belongs to, each once: the ones shared with the anchor first, then
	 * the rest, both by name — so a neighbour says where it comes from (owner, 2026-09-20).
	 */
	scopeIds: readonly string[];
	reasons: readonly NeighborReason[];
}>;

export type NeighborhoodOptions = Readonly<{
	/** Records taken on each side of the anchor by time (DP14). */
	radius: number;
}>;

export type Neighborhood = Readonly<{
	anchorId: string;
	anchorTime: MarkTime | null;
	anchorScopeIds: readonly string[];
	/** Older neighbours, oldest first, so the list reads top to bottom in time. */
	before: readonly Neighbor[];
	after: readonly Neighbor[];
	/** Explicitly linked records that are not among the temporal neighbours. */
	linked: readonly Neighbor[];
}>;
