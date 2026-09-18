/** Calendar units the time axis and periods are built from. */
export type AxisUnit = 'decade' | 'year' | 'month' | 'week' | 'day';

/** A visible time window in epoch milliseconds (UTC). */
export type AxisWindow = Readonly<{ start: number; end: number }>;

/**
 * Which rows the axis shows at a given scale and with what calendar step.
 * `middle` is only present on the day scale, where weeks get their own row.
 */
export type AxisSpec = Readonly<{
	major: AxisUnit;
	middle: 'week' | null;
	minor: AxisUnit | null;
	/** Calendar-anchored label step, applied to the major row when there is no minor row. */
	step: number;
	/** Day labels carry the weekday on the deepest scale. */
	weekdays: boolean;
}>;

/** One labelled division of the axis; clicking it selects the period it covers. */
export type AxisTick = Readonly<{
	unit: AxisUnit;
	start: number;
	end: number;
	label: string;
}>;

/** A calendar period addressed by unit and start; `end` is exclusive. */
export type PeriodRef = Readonly<{ unit: AxisUnit; start: number; end: number }>;
