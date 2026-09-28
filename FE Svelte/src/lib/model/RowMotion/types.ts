/** A row as the motion plan reads it: its id, the Scopes it stands for, and where it starts. */
export type MotionRow = Readonly<{ id: string; scopeIds: readonly string[]; y0: number }>;

/** Each moving row's offset at the glide's start, by row id: its old place minus its new one. */
export type MotionPlan = ReadonlyMap<string, number>;

/**
 * A row that folds away into another (the rest folding into one merged row): drawn as it was,
 * travelling `dy` from its old place to the row it folds into, and gone when the glide ends.
 */
export type Ghost = Readonly<{ id: string; dy: number }>;
