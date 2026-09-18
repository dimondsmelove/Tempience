import type { NeighborhoodFilter } from '$lib/model/Neighborhood/types';
import type { MessageKey } from '$lib/state/Locale/types';

/** «В этих Scope / Во всех» (DESIGN.md §8). */
export const FILTERS: readonly (readonly [NeighborhoodFilter, MessageKey])[] = [
	['these', 'neighborhood.these'],
	['all', 'neighborhood.all']
];
