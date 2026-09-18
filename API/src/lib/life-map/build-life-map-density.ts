import type { LifeMapDensity, LifeMapDensityQuery } from "@chronograph/shared";
import {
	densityStats,
	rollupWeekWeights,
	sparseFilledBuckets,
	weekStartsForIntervals,
	type WeekBounds
} from "@chronograph/shared";
import { fetchScopeIntervals } from "./fetch-scope-intervals";
import { fetchTraceWeekWeights } from "./fetch-trace-week-weights";
import { buildWeekCells, resolveLifeMapContext } from "./resolve-life-map-context";

const toWeekBounds = (
	ctx: Awaited<ReturnType<typeof resolveLifeMapContext>>,
	includeFutureScope: boolean
): WeekBounds => ({
	fromWeek: ctx.fromWeek,
	toWeek: ctx.toWeek,
	horizonDate: ctx.horizonDate,
	currentWeekStart: ctx.currentWeekStart,
	includeFutureScope
});

export const buildLifeMapDensity = async (
	query: LifeMapDensityQuery
): Promise<LifeMapDensity> => {
	const ctx = await resolveLifeMapContext({
		spaceUid: query.space_uid,
		from: query.from,
		to: query.to
	});
	const weeks = buildWeekCells(ctx);
	const bounds = toWeekBounds(ctx, query.scope_include_future ?? false);

	let weekWeights: Map<string, number>;

	if (query.layer === "scope") {
		const intervals = await fetchScopeIntervals(query.scope_kind!, query.scope_uid!);
		if (!intervals) {
			weekWeights = new Map();
		} else {
			const scopeWeeks = weekStartsForIntervals(intervals, bounds);
			weekWeights = new Map([...scopeWeeks].map((week) => [week, 1]));
		}
	} else {
		weekWeights = await fetchTraceWeekWeights(ctx.rangeFrom, ctx.rangeTo);
		for (const week of weeks) {
			if (!weekWeights.has(week.week_start)) continue;
		}
	}

	const allBuckets = rollupWeekWeights(weeks, weekWeights, query.resolution);
	const buckets = sparseFilledBuckets(allBuckets);
	const stats = densityStats(allBuckets);

	return {
		profile: {
			birth_date: ctx.birthDate,
			horizon_date: ctx.horizonDate,
			life_horizon_years: ctx.lifeHorizonYears,
			timezone: ctx.timezone
		},
		range: {
			from_week_start: ctx.fromWeek,
			to_week_start: ctx.toWeek
		},
		current_week_start: ctx.currentWeekStart,
		resolution: query.resolution,
		layer: query.layer,
		scope_kind: query.scope_kind,
		scope_uid: query.scope_uid,
		buckets,
		stats
	};
};
