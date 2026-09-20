import { HYSTERESIS_PX, MERGE_ZONE_END, MERGE_ZONE_START } from './constants';
import type { DragTargetOptions, DropTarget, RowBand } from './types';

/**
 * Where a dragged row would land (research «Открытые вопросы» п. 1; loop 006 C2): the
 * middle 44 % of a lane row merges into it, the edges insert above or below it, Alt
 * merges with the row under the pointer whatever the zone. The boundary between the two
 * zones has a dead zone of ±`HYSTERESIS_PX` around the previous target, so a pointer
 * resting on it never flickers. Pure geometry: `y` and the bands share a coordinate space.
 *
 * `bands` are the lane rows in lane order; the rows of an unfolded lane's children lie in
 * the gap after their parent's band and count as its block: an insert there goes after
 * the block, Alt there merges with the parent. `index` is a band index: a lane for
 * `merge`, an insertion point `0..bands.length` for `insert`. `null`: nothing to do —
 * no rows, or a drop on the dragged lane itself or right beside it.
 */
export const dragTarget = (
	y: number,
	bands: readonly RowBand[],
	{ alt = false, source = null, previous = null }: DragTargetOptions = {}
): DropTarget | null => {
	if (bands.length === 0) return null;
	const under = bands.findIndex((band) => y >= band.top && y < band.bottom);
	let above = -1;
	for (let index = 0; index < bands.length; index += 1) if (bands[index].top <= y) above = index;
	const settle = (target: DropTarget): DropTarget | null =>
		isSource(target, source) ? null : target;
	if (alt) return settle({ kind: 'merge', index: under >= 0 ? under : Math.max(0, above) });
	if (under < 0) return settle({ kind: 'insert', index: above + 1 });
	const band = bands[under];
	const height = band.bottom - band.top;
	let lower = band.top + height * MERGE_ZONE_START;
	let upper = band.top + height * MERGE_ZONE_END;
	if (previous?.kind === 'merge' && previous.index === under) {
		lower -= HYSTERESIS_PX;
		upper += HYSTERESIS_PX;
	} else if (
		previous?.kind === 'insert' &&
		(previous.index === under || previous.index === under + 1)
	) {
		lower += HYSTERESIS_PX;
		upper -= HYSTERESIS_PX;
	}
	if (y >= lower && y < upper) return settle({ kind: 'merge', index: under });
	return settle({ kind: 'insert', index: y < band.top + height / 2 ? under : under + 1 });
};

/** A merge with the dragged lane, or an insert at either of its own edges, changes nothing. */
const isSource = (target: DropTarget, source: number | null): boolean =>
	source !== null &&
	(target.kind === 'merge'
		? target.index === source
		: target.index === source || target.index === source + 1);
