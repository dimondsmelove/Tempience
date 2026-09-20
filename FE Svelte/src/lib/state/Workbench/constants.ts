import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';

export const EMPTY_SNAPSHOT: ExplorerSnapshot = Object.freeze({
	traces: [],
	scopes: [],
	periods: [],
	intersections: [],
	scopeSegments: []
});

/**
 * A one-shot request to open the workbench on a record: the key holds the record id, written
 * by whoever puts records in place before the app reloads (a seed, an import), consumed by the
 * workbench once after its first successful load, and removed either way.
 */
export const WORKBENCH_OPEN_AT_KEY = 'tempience.workbench.open-at';

/** A change from another device reads the snapshot again after this quiet spell: many rows of one change, one read. */
export const INBOUND_REFRESH_DEBOUNCE_MS = 500;
