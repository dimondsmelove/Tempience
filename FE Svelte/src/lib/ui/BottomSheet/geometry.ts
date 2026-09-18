import {
	SHEET_FLING_PROJECTION_MS,
	SHEET_CLOSE_RATIO,
	SHEET_HALF_RATIO,
	SHEET_PEEK_REM,
	SHEET_POSITIONS
} from './constants';
import type { SheetPosition } from './types';

export const sheetHeights = (available: number, rem: number): Record<SheetPosition, number> => ({
	peek: Math.min(SHEET_PEEK_REM * rem, available * 0.4),
	half: available * SHEET_HALF_RATIO,
	full: available
});

export const nearestPosition = (
	height: number,
	heights: Record<SheetPosition, number>,
	velocity = 0
): SheetPosition | null => {
	// Project the recent swipe speed; a paused drag settles at its actual height.
	height += Math.max(-3, Math.min(3, velocity)) * SHEET_FLING_PROJECTION_MS;
	if (height < heights.peek * SHEET_CLOSE_RATIO) return null;
	return SHEET_POSITIONS.reduce((nearest, position) =>
		Math.abs(heights[position] - height) < Math.abs(heights[nearest] - height) ? position : nearest
	);
};
