import type { ExplorerTrace } from '$lib/model/Snapshot/types';

export type DayBucket = { dayKey: string; items: ExplorerTrace[] };
export type WeekBuckets = {
	/** Epoch milliseconds of Monday midnight in the supplied zone. */
	weekStart: number;
	days: DayBucket[];
	week: ExplorerTrace[];
	undated: ExplorerTrace[];
	review: ExplorerTrace[];
	later: ExplorerTrace[];
	outside: number;
};
