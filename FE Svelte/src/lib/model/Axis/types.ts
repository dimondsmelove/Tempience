/** Calendar units the time axis and periods are built from. */
export type AxisUnit = 'decade' | 'year' | 'month' | 'week' | 'day';

/** A visible time window in epoch milliseconds (UTC). */
export type AxisWindow = Readonly<{ start: number; end: number }>;

/** Which calendar rows the axis shows, from the farthest scale to the closest (DESIGN.md §6). */
export type AxisBand = 'decades' | 'years' | 'months' | 'weeks' | 'days' | 'weekdays';

/** Text widths of the widest label of each kind, in pixels, without paddings. */
export type LabelWidths = Readonly<{
	decade: number;
	year: number;
	month: number;
	week: number;
	/** A week label with its Monday date, «н52 · 30». */
	weekDate: number;
	day: number;
	/** A day label with its weekday, «пн 31». */
	weekday: number;
}>;

/**
 * Which rows the axis shows at a given scale and with what calendar step.
 * `middle` is only present on the day scale, where weeks get their own row.
 */
export type AxisSpec = Readonly<{
	band: AxisBand;
	major: AxisUnit;
	middle: 'week' | null;
	minor: AxisUnit | null;
	/** Calendar-anchored label step of the minor row, or of the major row when there is no minor row. */
	step: number;
	/** Day labels carry the weekday on the deepest scale. */
	weekdays: boolean;
	/** Week labels carry the Monday date when a stepped cell has room for it. */
	weekDate: boolean;
}>;

/** One calendar cell of an axis row; clicking it selects the period it covers. */
export type AxisTick = Readonly<{
	unit: AxisUnit;
	start: number;
	end: number;
	label: string;
	/** Whether the cell is on the row's label step; the others show their label only under the pointer. */
	labelled: boolean;
}>;

/** A calendar period addressed by unit and start; `end` is exclusive. */
export type PeriodRef = Readonly<{ unit: AxisUnit; start: number; end: number }>;
