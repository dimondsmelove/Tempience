import type { RecordShape } from '$lib/model/RecordGroups/types';

/**
 * A record's mark in a Context list, painted as the ribbon paints it: the head (a fact's capsule,
 * an interval's head, an intention's tick) and the band after it, each a CSS background.
 */
export type MarkPaint = Readonly<{
	shape: RecordShape;
	/** The head's width: 3 px, 4 when woven; none for a vague window. */
	head: number;
	headFill: string | null;
	/** The 30 % band of an interval or a vague window; none for a fact or an intention. */
	band: number;
	bandFill: string | null;
	/** The head is cut into the intention's dots. */
	dotted: boolean;
	woven: boolean;
}>;
