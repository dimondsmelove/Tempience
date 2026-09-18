import type { DataSpaceId } from '$lib/state/triplit/data-space';

/**
 * The one chance to take back what was just done (DP23). An offer names the operation it
 * would compensate and the space that operation belongs to: the inverse acts on the records
 * of that space, and an offer that outlived its space acts on nothing.
 *
 * The two steps are separate on purpose. `invert` writes and may be attempted again only
 * while it has never succeeded; `read` shows the result and may be repeated freely. Once the
 * inverse has committed, nothing offers to write it a second time.
 */
export type UndoOffer = Readonly<{
	/** What was done, as the toast names it; a reader gives the words of the moment's language. */
	label: string | (() => string);
	space: DataSpaceId;
	/** Compensates the operation. The causal inverse, refusing whole when a consequence moved. */
	invert: () => Promise<void>;
	/** Shows what the inverse did. Never writes, so it can be asked for again. */
	read: () => Promise<void>;
}>;
