import type { AxisUnit } from '$lib/model/Axis/types';
import type { MessageKey } from '$lib/state/Locale/types';

export const UNIT_KEYS: Readonly<Record<AxisUnit, MessageKey>> = {
	day: 'period.unit_day',
	week: 'period.unit_week',
	month: 'period.unit_month',
	year: 'period.unit_year',
	decade: 'period.unit_decade'
};
