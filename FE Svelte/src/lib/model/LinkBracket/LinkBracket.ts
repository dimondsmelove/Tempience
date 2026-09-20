import { LINK_CHANNEL_PX, LINK_GAP_PX, LINK_TICK_WIDTH_PX } from './constants';
import type { Bracket, BracketAnchor } from './types';

/** Centre of a 1 px line on the pixel grid. */
const crisp = (value: number): number => Math.round(value) + 0.5;

/**
 * The projection of a linked record a bracket goes to: the one in the trunk's
 * own row when there is one, else the one in the nearest row (the upper of two
 * at the same distance). A record with no projection on the ribbon gets none.
 */
export const nearestProjection = <T extends Readonly<{ rowIndex: number }>>(
	projections: readonly T[] | undefined,
	rowIndex: number
): T | null => {
	let best: T | null = null;
	for (const candidate of projections ?? []) {
		if (!best || Math.abs(candidate.rowIndex - rowIndex) < Math.abs(best.rowIndex - rowIndex))
			best = candidate;
	}
	return best;
};

/**
 * The bracket from the selected mark to one record it is linked with
 * (research п. 15): the ribbon is a 90° grid, so links are brackets, not arcs.
 * The trunk drops from the mark into a channel 22 px under the row's centre,
 * runs along it to the target's x, then rises to the target's bottom edge in
 * the same row or drops to its top edge in a row below. For a target in a row
 * above, the channel runs 22 px above the centre and the last leg rises to the
 * target's bottom edge. Several targets share the trunk and fan out along the
 * channel; the bracket ends in a short bar at the target.
 */
export const linkBracket = (
	trunk: BracketAnchor,
	target: BracketAnchor,
	channelPx = LINK_CHANNEL_PX
): Bracket => {
	const down = target.rowIndex >= trunk.rowIndex;
	const sameRow = target.rowIndex === trunk.rowIndex;
	const channel = crisp(trunk.rowCentreY + (down ? channelPx : -channelPx));
	const from = down ? trunk.y1 + LINK_GAP_PX : trunk.y0 - LINK_GAP_PX;
	const to = sameRow || !down ? target.y1 + LINK_GAP_PX : target.y0 - LINK_GAP_PX;
	const x0 = crisp(trunk.x);
	const x1 = crisp(target.x);
	return {
		points: [
			{ x: x0, y: from },
			{ x: x0, y: channel },
			{ x: x1, y: channel },
			{ x: x1, y: to }
		],
		// The bar sits between the line's end and the target: under a top edge, over a bottom edge.
		tick: {
			x: x1 - LINK_TICK_WIDTH_PX / 2,
			y: Math.round(to) - (down && !sameRow ? 0 : 1)
		}
	};
};
