import {
	AXIS_BAND_ORDER,
	AXIS_BANDS,
	BAND_HYSTERESIS,
	DAY_STEPS,
	DECADE_STEPS,
	LABEL_PADDING_PX,
	LABEL_WIDTHS,
	MIN_UNIT_DAYS,
	MONTH_STEPS,
	WEEK_STEPS,
	YEAR_STEPS
} from './constants';
import type { AxisBand, AxisSpec, LabelWidths } from './types';

export type AxisSpecOptions = Readonly<{
	/** Measured text widths of the widest labels; the baseline constants stand in for the rest. */
	widths?: Partial<LabelWidths>;
	/** Text enlargement: the row thresholds and the baseline widths grow with it. */
	textScale?: number;
	/** The band of the previous draw; a threshold is crossed only 4 % beyond it. */
	previous?: AxisBand | null;
}>;

/** The smallest step whose cells fit the widest label with its paddings; `null` when none does. */
const fitStep = (unitPx: number, steps: readonly number[], labelWidth: number): number | null =>
	steps.find((step) => step * unitPx >= labelWidth + LABEL_PADDING_PX) ?? null;

/** Which rows the scale gets, with hysteresis against the previous band around each threshold. */
const bandAt = (
	ppd: number,
	widths: LabelWidths,
	textScale: number,
	previous?: AxisBand | null
) => {
	const room = (width: number) => width + LABEL_PADDING_PX;
	// Threshold `i` separates AXIS_BAND_ORDER[i] from AXIS_BAND_ORDER[i + 1].
	const edges = [
		room(widths.year) / MIN_UNIT_DAYS.year,
		room(widths.month) / (MONTH_STEPS[2] * MIN_UNIT_DAYS.month),
		AXIS_BANDS.MONTH_WEEKS * textScale,
		AXIS_BANDS.WEEKS_DAYS * textScale,
		Math.max(AXIS_BANDS.WEEKDAYS * textScale, room(widths.weekday))
	];
	const raw = edges.filter((edge) => ppd >= edge).length;
	const kept = previous ? AXIS_BAND_ORDER.indexOf(previous) : -1;
	if (kept >= 0 && Math.abs(raw - kept) === 1) {
		const edge = edges[Math.min(raw, kept)];
		if (Math.abs(ppd - edge) / edge < BAND_HYSTERESIS) return AXIS_BAND_ORDER[kept];
	}
	return AXIS_BAND_ORDER[raw];
};

const scaledWidths = (textScale: number): LabelWidths => ({
	decade: LABEL_WIDTHS.decade * textScale,
	year: LABEL_WIDTHS.year * textScale,
	month: LABEL_WIDTHS.month * textScale,
	week: LABEL_WIDTHS.week * textScale,
	weekDate: LABEL_WIDTHS.weekDate * textScale,
	day: LABEL_WIDTHS.day * textScale,
	weekday: LABEL_WIDTHS.weekday * textScale
});

/** Calendar detail follows the room each row has for its widest label, measured with its font. */
export const axisSpec = (ppd: number, options: AxisSpecOptions = {}): AxisSpec => {
	const textScale = options.textScale ?? 1;
	const widths: LabelWidths = { ...scaledWidths(textScale), ...options.widths };
	const band = bandAt(ppd, widths, textScale, options.previous);
	const base = { band, middle: null, weekdays: false, weekDate: false };
	switch (band) {
		case 'decades':
			return {
				...base,
				major: 'decade',
				minor: null,
				step: fitStep(MIN_UNIT_DAYS.decade * ppd, DECADE_STEPS, widths.decade) ?? 10
			};
		case 'years':
			return {
				...base,
				major: 'year',
				minor: null,
				step: fitStep(MIN_UNIT_DAYS.year * ppd, YEAR_STEPS, widths.year) ?? 5
			};
		case 'months':
			return {
				...base,
				major: 'year',
				minor: 'month',
				step: fitStep(MIN_UNIT_DAYS.month * ppd, MONTH_STEPS, widths.month) ?? 6
			};
		case 'weeks': {
			const step = fitStep(MIN_UNIT_DAYS.week * ppd, WEEK_STEPS, widths.week) ?? 4;
			return {
				...base,
				major: 'month',
				minor: 'week',
				step,
				weekDate: step * MIN_UNIT_DAYS.week * ppd >= widths.weekDate + LABEL_PADDING_PX
			};
		}
		case 'days':
			return {
				...base,
				major: 'month',
				middle: 'week',
				minor: 'day',
				step: fitStep(ppd, DAY_STEPS, widths.day) ?? 10
			};
		case 'weekdays':
			return { ...base, major: 'month', middle: 'week', minor: 'day', step: 1, weekdays: true };
	}
};
