import type { AxisUnit } from '$lib/model/Axis/types';

/** Persisted Periods live at local midnight of their zone; the axis at UTC midnight. */
export const BOUNDS_TOLERANCE_MS = 14 * 3_600_000;

export const PARENT_UNIT: Readonly<Record<AxisUnit, AxisUnit | null>> = {
	day: 'week',
	week: 'month',
	month: 'year',
	year: 'decade',
	decade: null
};

export const CHILD_UNIT: Readonly<Record<AxisUnit, AxisUnit | null>> = {
	day: null,
	week: 'day',
	month: 'week',
	year: 'month',
	decade: 'year'
};
