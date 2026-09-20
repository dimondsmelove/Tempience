import type { NeighborhoodOptions } from './types';

export const DAY_MS = 86_400_000;

/** DP14: five neighbours on each side, across every Scope (the filter went on 2026-09-20). */
export const DEFAULT_NEIGHBORHOOD_OPTIONS: NeighborhoodOptions = { radius: 5 };
