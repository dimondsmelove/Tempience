import type { LifeWeekCell } from "../schemas/life-map";
import type { LifeMapDensityBucket, LifeMapDensityResolution } from "../schemas/life-map-density";

const monthKey = (weekStart: string): string => weekStart.slice(0, 7);
const yearKey = (weekStart: string): string => weekStart.slice(0, 4);
const decadeKey = (weekStart: string): string => {
	const year = Number(weekStart.slice(0, 4));
	return String(Math.floor(year / 10) * 10);
};

export const rollupWeekWeights = (
	weeks: LifeWeekCell[],
	weekWeights: Map<string, number>,
	resolution: LifeMapDensityResolution
): LifeMapDensityBucket[] => {
	if (resolution === "week") {
		return weeks.map((week) => {
			const weight = weekWeights.get(week.week_start) ?? 0;
			return {
				key: week.week_start,
				filled: weight > 0,
				weight
			};
		});
	}

	const buckets = new Map<string, number>();

	for (const week of weeks) {
		const weight = weekWeights.get(week.week_start) ?? 0;
		if (weight <= 0) continue;

		const key =
			resolution === "month"
				? monthKey(week.week_start)
				: resolution === "year"
					? yearKey(week.week_start)
					: decadeKey(week.week_start);

		buckets.set(key, (buckets.get(key) ?? 0) + weight);
	}

	if (resolution === "month") {
		const byYear = new Map<number, Set<string>>();
		for (const week of weeks) {
			const year = Number(week.week_start.slice(0, 4));
			const set = byYear.get(year) ?? new Set<string>();
			set.add(monthKey(week.week_start));
			byYear.set(year, set);
		}

		const ordered: LifeMapDensityBucket[] = [];
		for (const year of [...byYear.keys()].sort((a, b) => a - b)) {
			for (let month = 1; month <= 12; month += 1) {
				const key = `${year}-${String(month).padStart(2, "0")}`;
				const weight = buckets.get(key) ?? 0;
				ordered.push({ key, filled: weight > 0, weight });
			}
		}
		return ordered;
	}

	if (resolution === "year") {
		const decades = new Map<number, number[]>();
		for (const week of weeks) {
			const year = Number(yearKey(week.week_start));
			const decade = Math.floor(year / 10) * 10;
			const list = decades.get(decade) ?? [];
			if (!list.includes(year)) list.push(year);
			decades.set(decade, list);
		}

		const ordered: LifeMapDensityBucket[] = [];
		for (const decade of [...decades.keys()].sort((a, b) => a - b)) {
			for (const year of decades.get(decade)!.sort((a, b) => a - b)) {
				const key = String(year);
				const weight = buckets.get(key) ?? 0;
				ordered.push({ key, filled: weight > 0, weight });
			}
		}
		return ordered;
	}

	const decades = [...new Set(weeks.map((week) => decadeKey(week.week_start)))].sort();
	return decades.map((key) => {
		const weight = buckets.get(key) ?? 0;
		return { key: `${key}s`, filled: weight > 0, weight };
	});
};

export const sparseFilledBuckets = (buckets: LifeMapDensityBucket[]): LifeMapDensityBucket[] =>
	buckets.filter((bucket) => bucket.filled);

export const densityStats = (
	buckets: LifeMapDensityBucket[]
): { total_buckets: number; filled_buckets: number } => ({
	total_buckets: buckets.length,
	filled_buckets: buckets.filter((bucket) => bucket.filled).length
});
