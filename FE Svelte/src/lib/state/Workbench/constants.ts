import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';

export const EMPTY_SNAPSHOT: ExplorerSnapshot = Object.freeze({
	traces: [],
	scopes: [],
	periods: [],
	intersections: [],
	scopeSegments: []
});
