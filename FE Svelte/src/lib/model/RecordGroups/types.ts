/** How a Context draws a record in its list: the ribbon's mark in its Scope's colour. */
export type RecordShape = 'fact' | 'interval' | 'fuzzy' | 'fuzzySpan' | 'intent';

/** A stretch of a list: a week, a day or a month, with its records. */
export type RecordGroup<T> = Readonly<{
	key: number;
	/** «н37 · 7–13 сент.», «пн, 7 сент.», «сентябрь 2026». */
	label: string;
	items: readonly T[];
}>;

/** Which calendar unit a list is cut by; none keeps one plain list. */
export type GroupUnit = 'month' | 'week' | 'day';
