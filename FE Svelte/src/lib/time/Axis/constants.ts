export const AXIS_HEIGHT_PX = 44;
export const WHEEL_LINE_PX = 16;

/** Vertical layout of the two- and three-row axis (DESIGN.md §6). */
export const AXIS_ROWS = Object.freeze({
	two: { majorText: 12, majorHit: [2, 21], minorText: 32, minorHit: [23, 43], minorTick: 38 },
	three: {
		majorText: 9,
		majorHit: [1, 17],
		weekHit: [17, 28],
		weekText: 22.5,
		minorText: 36,
		minorHit: [28, 43],
		minorTick: 38
	}
});

export const AXIS_FONT_MAJOR = '600 12px';
export const AXIS_FONT_WEEK = '10px';
export const AXIS_FONT_MINOR = '11px';
/** The plate of a pinned label stays this far inside its row's hit band, with rounded corners. */
export const PLATE_INSET_PX = 1;
export const PLATE_RADIUS_PX = 3;
/** A ghost label, the hovered cell's text when it is not on the step, is muted ink at this alpha. */
export const GHOST_ALPHA = 0.6;
export const ZEBRA_ALPHA = 0.06;
/** The current week's label is accent with an underline this thick and this wide (research п. 6, mock v6.2). */
export const CURRENT_WEEK_UNDERLINE_PX = 2;
export const CURRENT_WEEK_UNDERLINE_WIDTH_PX = 24;
/** Every minor boundary has a tick this tall; stepped cells get the taller one from `minorTick`. */
export const MINOR_TICK_PX = 4;

export const scaledAxisRows = (scale: number) => {
	const span = (value: readonly [number, number]): [number, number] => [
		value[0] * scale,
		value[1] * scale
	];
	const two = AXIS_ROWS.two,
		three = AXIS_ROWS.three;
	return {
		two: {
			majorText: two.majorText * scale,
			majorHit: span(two.majorHit as [number, number]),
			minorText: two.minorText * scale,
			minorHit: span(two.minorHit as [number, number]),
			minorTick: two.minorTick * scale
		},
		three: {
			majorText: three.majorText * scale,
			majorHit: span(three.majorHit as [number, number]),
			weekHit: span(three.weekHit as [number, number]),
			weekText: three.weekText * scale,
			minorText: three.minorText * scale,
			minorHit: span(three.minorHit as [number, number]),
			minorTick: three.minorTick * scale
		}
	};
};
/** A period with a note carries an accent bar this thick along the top edge of its cell, at this alpha. */
export const NOTE_BAR_PX = 2;
export const NOTE_BAR_ALPHA = 0.7;
