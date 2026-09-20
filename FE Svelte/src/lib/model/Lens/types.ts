import type { LitSet } from '$lib/model/Hover/types';
import type { TimeRange } from '$lib/model/Projection/types';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';

/**
 * What the lens draws above the veil (loop 008, B): the lit records and the rows
 * named in bold, plus the column of a hovered period — the time it tints, or
 * `null` when the target has no time of its own.
 */
export type LensSet = Readonly<LitSet & { range: TimeRange | null }>;

/** What the resolvers read of the snapshot: the Scope tree, the memberships and the Kinds of the records. */
export type LensView = Pick<ExplorerSnapshot, 'traces' | 'scopes' | 'intersections'>;
