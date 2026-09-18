import type { LifeMapProjection } from "@chronograph/shared";
import { instantRangeOverlaps } from "@chronograph/shared";
import { asc } from "drizzle-orm";
import { db } from "../../db/client";
import { scopePhases, scopes } from "../../db/schema";
import { scopeToContinuity, scopeToTask } from "../scope/scope-mappers";
import { mapContinuitySegment } from "../temporal-mappers";
import { fetchTraceWeekWeights } from "./fetch-trace-week-weights";
import { buildWeekCells, resolveLifeMapContext } from "./resolve-life-map-context";

type ScopeRow = typeof scopes.$inferSelect;
type SegmentRow = typeof scopePhases.$inferSelect;

const scopeIntersects = (
	scope: ScopeRow,
	segments: SegmentRow[],
	rangeFrom: string,
	rangeTo: string
): boolean => {
	if (instantRangeOverlaps(scope.startedAt, scope.endedAt, rangeFrom, rangeTo)) {
		return true;
	}
	return segments.some((segment) =>
		instantRangeOverlaps(segment.startAt, segment.endAt, rangeFrom, rangeTo)
	);
};

export const buildLifeMapProjection = async (input: {
	spaceUid: string;
	from?: string;
	to?: string;
	now?: string;
}): Promise<LifeMapProjection> => {
	const ctx = await resolveLifeMapContext(input);
	const { rangeFrom, rangeTo } = ctx;

	const [scopeRows, segmentRows, traceWeekWeights] = await Promise.all([
		db.select().from(scopes).orderBy(asc(scopes.name)),
		db.select().from(scopePhases).orderBy(asc(scopePhases.sortOrder)),
		fetchTraceWeekWeights(rangeFrom, rangeTo)
	]);

	const segmentsByScope = new Map<string, SegmentRow[]>();
	for (const segment of segmentRows) {
		const list = segmentsByScope.get(segment.continuityUid) ?? [];
		list.push(segment);
		segmentsByScope.set(segment.continuityUid, list);
	}

	const continuityScopes = scopeRows.filter((row) => row.kind === "continuity");
	const processScopes = scopeRows.filter((row) => row.kind === "process" && !row.parentScopeUid);

	const projectedContinuities = continuityScopes
		.filter((scope) => scopeIntersects(scope, segmentsByScope.get(scope.uid) ?? [], rangeFrom, rangeTo))
		.map((scope) => ({
			continuity: scopeToContinuity(scope),
			segments: (segmentsByScope.get(scope.uid) ?? []).map(mapContinuitySegment)
		}));

	const continuityUidSet = new Set(projectedContinuities.map((entry) => entry.continuity.uid));

	const projectedProcesses = processScopes
		.filter((scope) => {
			const parentContinuityUid = scope.parentScopeUid;
			const linked = parentContinuityUid ? continuityUidSet.has(parentContinuityUid) : false;
			return (
				scopeIntersects(scope, segmentsByScope.get(scope.uid) ?? [], rangeFrom, rangeTo) || linked
			);
		})
		.map((scope) => ({
			task: scopeToTask(scope),
			segments: (segmentsByScope.get(scope.uid) ?? []).map((segment) => ({
				uid: segment.uid,
				task_uid: segment.continuityUid,
				phase: segment.phase,
				start_at: segment.startAt,
				end_at: segment.endAt,
				label: segment.label,
				sort_order: segment.sortOrder,
				created_at: segment.createdAt
			})),
			continuity_uids: scope.parentScopeUid ? [scope.parentScopeUid] : []
		}));

	const weeks = buildWeekCells(ctx);

	const week_coverage = weeks.map((week) => ({
		week_start: week.week_start,
		has_traces: (traceWeekWeights.get(week.week_start) ?? 0) > 0
	}));

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
		weeks,
		continuities: projectedContinuities,
		processes: projectedProcesses,
		closures: [],
		week_coverage
	} as LifeMapProjection;
};
