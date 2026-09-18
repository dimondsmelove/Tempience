import type { NeighborhoodOptions } from './types';

export const DAY_MS = 86_400_000;

/** DP14: five neighbours on each side, within the anchor's own Scopes. */
export const DEFAULT_NEIGHBORHOOD_OPTIONS: NeighborhoodOptions = { radius: 5, filter: 'these' };
