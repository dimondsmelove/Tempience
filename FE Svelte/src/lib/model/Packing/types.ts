/** What packing needs to know about a record: identity, time span and whether it is a point. */
export type PackKind = 'point' | 'interval';

export type PackItem = Readonly<{
	id: string;
	/** Epoch milliseconds, UTC. */
	start: number;
	/** Exclusive end for intervals; `null` for points. */
	end: number | null;
	kind: PackKind;
}>;

export type PackOptions = Readonly<{
	pxPerDay: number;
	/** Rows hold at most this many tracks; beyond it items overlap inside tracks. */
	maxTracks?: number;
	/** Point width in pixels is `pxPerDay` clamped to this range. */
	minPointWidth?: number;
	maxPointWidth?: number;
	/** Horizontal gap that keeps two items on one track apart, in pixels. */
	gap?: number;
}>;

/** Vertical geometry of the tracks inside a row of a given height (C9a-2). */
export type TrackGeometry = Readonly<{
	pitchPx: number;
	trackHeightPx: number;
}>;

export type PackResult = Readonly<{
	/** Track index per item id, stable for a given scale regardless of the visible window. */
	trackOf: ReadonlyMap<string, number>;
	/** Tracks actually used, at least 1. */
	tracks: number;
	/** Items that had to share a track with an item they overlap. */
	overlaps: number;
}>;
