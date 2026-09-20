import { LABEL_INSET_PX, LABEL_PADDING_PX, PIN_X_PX } from './constants';
import type { AxisTick } from './types';

/** Where one cell's label ends up in its row. */
export type PlacedLabel = Readonly<{
	/** The text the cell shows, with the year when it is the leftmost month label of the row. */
	text: string;
	/** Width of `text`, in pixels. */
	width: number;
	/** Left edge of the text; on the plate when pinned. */
	x: number;
	/** Whether the label is drawn: stepped, in view and clear of its neighbours. */
	drawn: boolean;
	/** Pinned at the left edge on a plate: the cell is cut by the edge but still has room. */
	pinned: boolean;
}>;

export type PlaceLabelsInput = Readonly<{
	cells: readonly AxisTick[];
	/** Canvas x of a time. */
	x: (t: number) => number;
	/** Text width in the row's font. */
	measure: (text: string) => number;
	/** The text of a cell; `leftmost` is true for the first label the row shows. */
	text: (cell: AxisTick, leftmost: boolean) => string;
}>;

/**
 * Lays the labels of one row out (DR 008 v4, п. 3): a stepped label sits 6 px after its
 * boundary; the label of the cell cut by the left edge is pinned at x = 4 on a plate while
 * its cell still has room for it (`end − 4 ≥ width + 16`), otherwise the next label takes the
 * edge. The first label shown is the row's leftmost and always drawn; any label that would
 * run into the one before it is left out, its period staying clickable.
 */
export const placeLabels = ({ cells, x, measure, text }: PlaceLabelsInput) => {
	const placed: PlacedLabel[] = [];
	let occupied = -Infinity;
	let shown = false;
	for (const cell of cells) {
		const px = x(cell.start);
		const plain = { drawn: false, pinned: false };
		if (!cell.labelled) {
			placed.push({ ...plain, text: text(cell, false), width: 0, x: px + LABEL_INSET_PX });
			continue;
		}
		const label = text(cell, !shown);
		const width = measure(label);
		if (px + LABEL_INSET_PX < PIN_X_PX) {
			const room = x(cell.end) - PIN_X_PX >= width + PIN_X_PX + LABEL_PADDING_PX;
			if (room) {
				occupied = PIN_X_PX + width + LABEL_PADDING_PX + LABEL_INSET_PX;
				shown = true;
			}
			placed.push({
				text: label,
				width,
				x: PIN_X_PX + LABEL_PADDING_PX / 2,
				drawn: room,
				pinned: room
			});
			continue;
		}
		const left = px + LABEL_INSET_PX;
		const drawn = left >= occupied;
		if (drawn) {
			occupied = left + width + LABEL_INSET_PX;
			shown = true;
		}
		placed.push({ text: label, width, x: left, drawn, pinned: false });
	}
	return placed;
};
