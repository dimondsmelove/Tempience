/**
 * A row as the motion plan reads it: its id, the Scopes it stands for, and where it starts; a
 * Scope row also its ancestors (nearest first) and whether it stands unfolded, so a child row
 * comes out of its folded parent and goes back into it (owner review of PR #102, 2026-10-02).
 */
export type MotionRow = Readonly<{
	id: string;
	scopeIds: readonly string[];
	y0: number;
	ancestorIds?: readonly string[];
	expanded?: boolean;
}>;

/** Each moving row's offset at the glide's start, by row id: its old place minus its new one. */
export type MotionPlan = ReadonlyMap<string, number>;

/**
 * A row that folds away into another (the rest folding into one merged row): drawn as it was,
 * travelling `dy` from its old place to the row it folds into (`into`), and gone when the glide
 * ends.
 */
export type Ghost = Readonly<{ id: string; dy: number; into: string }>;
