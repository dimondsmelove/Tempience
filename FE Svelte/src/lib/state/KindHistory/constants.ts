import type { HistoryFilters, VersionPages } from './types';

/** Rows of one table page: a phone reads it without scrolling far, a desktop without a wall. */
export const PAGE_SIZE = 50;

export const UNCONSTRAINED: HistoryFilters = {
	versionIds: null,
	scope: null,
	from: '',
	to: '',
	values: []
};

/** Where every version's table starts: its first page, the undated group folded. */
export const FIRST: VersionPages = { dated: 0, undated: 0, undatedOpen: false };
