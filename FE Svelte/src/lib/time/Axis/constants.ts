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
export const STICKY_PADDING_PX = 7;
export const STICKY_LEFT_PX = 4;
export const ZEBRA_ALPHA = 0.06;

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
