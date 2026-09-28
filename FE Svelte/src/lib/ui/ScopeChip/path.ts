import { PATH_MIN_ANCESTOR_PX } from './constants';

/** Which ancestors a chip shows, root first, and whether «…» stands for the rest. */
export type PathFit = Readonly<{ kept: readonly number[]; ellipsis: boolean }>;

export type PathWidths = Readonly<{
	/** Each ancestor's natural width, root first. */
	ancestors: readonly number[];
	leaf: number;
	/** One « › » between two names. */
	separator: number;
	/** The «…» itself. */
	ellipsis: number;
	/** The room the names have in the chip's container. */
	available: number;
	/** How narrow an ancestor may shrink before the path collapses. */
	minAncestor?: number;
}>;

/**
 * How «Корень › … › Лист» fits its room: the whole path while it fits; the ancestors shrink
 * first (to `minAncestor`, truncated); then the middle collapses to «…» keeping the root while
 * root, «…» and the leaf fit; else «…» and the leaf. The leaf is never cut.
 */
export const fitPath = ({
	ancestors,
	leaf,
	separator,
	ellipsis,
	available,
	minAncestor = PATH_MIN_ANCESTOR_PX
}: PathWidths): PathFit => {
	const all = ancestors.map((_, index) => index);
	if (!ancestors.length) return { kept: [], ellipsis: false };
	const shrunk = ancestors.reduce((sum, width) => sum + Math.min(width, minAncestor), 0);
	if (shrunk + separator * ancestors.length + leaf <= available)
		return { kept: all, ellipsis: false };
	if (ancestors.length > 1) {
		const root = Math.min(ancestors[0], minAncestor);
		if (root + ellipsis + separator * 2 + leaf <= available) return { kept: [0], ellipsis: true };
	}
	return { kept: [], ellipsis: true };
};
