import type { AxisUnit } from '$lib/model/Axis/types';
import type { GroupUnit } from './types';

/** A period's list is cut by the unit under it: a year by months, a month by weeks, a week by days. */
export const GROUP_UNDER: Readonly<Record<AxisUnit, GroupUnit | null>> = {
	decade: 'month',
	year: 'month',
	month: 'week',
	week: 'day',
	day: null
};

/** A list shorter than this stays one plain list: headers over two records only add noise. */
export const MIN_GROUPED = 4;
