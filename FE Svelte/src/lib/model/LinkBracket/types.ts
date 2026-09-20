/** One end of a bracket: where a mark stands and which row holds it. */
export type BracketAnchor = Readonly<{
	/** Canvas x the bracket meets the mark at (its head). */
	x: number;
	/** Vertical extent of the mark's silhouette. */
	y0: number;
	y1: number;
	rowIndex: number;
	/** Centre line of the row; the channel runs at a fixed distance from it. */
	rowCentreY: number;
}>;

export type Point = Readonly<{ x: number; y: number }>;

/** A solid bracket from the selected mark to one target, and the tick that ends it. */
export type Bracket = Readonly<{
	/** Trunk down (or up) from the mark, along the channel, then to the target: four points. */
	points: readonly Point[];
	/** The 5 × 1.5 px bar at the target, as its top-left corner. */
	tick: Point;
}>;
