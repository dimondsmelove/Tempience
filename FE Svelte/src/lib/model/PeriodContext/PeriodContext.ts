import { floorUnit, nextUnit, periodAt, periodTitle, prevUnit } from '$lib/model/Axis/Axis';
import type { PeriodRef } from '$lib/model/Axis/types';
import { projectSnapshot } from '$lib/model/Projection/Projection';
import type { ProjectionState } from '$lib/model/Projection/types';
import { traceMarkTime } from '$lib/model/Projection/marks';
import { scopeMembership } from '$lib/model/Projection/tree';
import { periodTimeBounds } from '$lib/state/triplit/period-time';
import type { PeriodTime } from '$lib/state/triplit/types';
import type { ExplorerPeriod, ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { translate } from '$lib/state/Locale/messages';
import { BOUNDS_TOLERANCE_MS, CHILD_UNIT, PARENT_UNIT, UNSCOPED_GROUP_KEY } from './constants';
import type { PeriodContext, PeriodNeighbors, PeriodScopeGroup, PeriodTrace } from './types';

const pad = (value: number): string => String(value).padStart(2, '0');
const calendarDay = (t: number): string => {
	const d = new Date(t);
	return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/** The `PeriodTime` a persisted Period gets when it is created for a calendar period. */
export const periodDraftTime = (period: PeriodRef): PeriodTime => {
	const start = new Date(period.start);
	if (period.unit === 'year' || period.unit === 'decade') {
		const year = String(start.getUTCFullYear());
		return {
			precision: 'year',
			start: year,
			end: String(new Date(period.end - 1).getUTCFullYear())
		};
	}
	if (period.unit === 'month') {
		const month = `${start.getUTCFullYear()}-${pad(start.getUTCMonth() + 1)}`;
		return { precision: 'month', start: month, end: month };
	}
	return {
		precision: 'day',
		start: calendarDay(period.start),
		end: calendarDay(period.end - 1)
	};
};

const matchesPeriod = (record: ExplorerPeriod, period: PeriodRef): boolean => {
	try {
		const bounds = periodTimeBounds(record.time, record.timezone);
		return (
			Math.abs(bounds.start - period.start) <= BOUNDS_TOLERANCE_MS &&
			Math.abs(bounds.end - period.end) <= BOUNDS_TOLERANCE_MS
		);
	} catch {
		return false;
	}
};

export const periodNeighbors = (period: PeriodRef): PeriodNeighbors => {
	const parentUnit = PARENT_UNIT[period.unit];
	const childUnit = CHILD_UNIT[period.unit];
	const children: PeriodRef[] = [];
	if (childUnit) {
		for (let t = floorUnit(period.start, childUnit); t < period.end; t = nextUnit(t, childUnit))
			children.push({ unit: childUnit, start: t, end: nextUnit(t, childUnit) });
	}
	return {
		previous: { unit: period.unit, start: prevUnit(period.start, period.unit), end: period.start },
		next: { unit: period.unit, start: period.end, end: nextUnit(period.end, period.unit) },
		parent: parentUnit ? periodAt(period.start, parentUnit) : null,
		children
	};
};

/**
 * What the Context shows for a calendar period (DESIGN.md §8): its persisted
 * note, the records inside it grouped by Scope, the Scopes that are active in
 * it and the neighbouring periods. Pure over the snapshot.
 */
export const periodContext = (
	snapshot: ExplorerSnapshot,
	period: PeriodRef,
	filters?: Omit<ProjectionState, 'expanded'>
): PeriodContext => {
	// Use the ribbon's filters over direct placements: disclosure is not a record filter.
	const filtered = filters
		? projectSnapshot(snapshot, {
				...filters,
				grouping: 'scope',
				expanded: new Set(snapshot.scopes.map((scope) => scope.id))
			})
		: null;
	const scopeIdsInSnapshot = new Set(snapshot.scopes.map((scope) => scope.id));
	const membership = scopeMembership(snapshot.traces, snapshot.scopes, snapshot.intersections);
	const groupsByScope = new Map<string | null, PeriodTrace[]>();
	let traceCount = 0;
	for (const trace of snapshot.traces) {
		if (filtered && !filtered.marksByTraceId.has(trace.id)) continue;
		const time = traceMarkTime(trace);
		if (!time || time.end < period.start || time.start >= period.end) continue;
		traceCount += 1;
		const item: PeriodTrace = { traceId: trace.id, label: trace.content, time };
		const scopeIds = filtered
			? new Set(
					filtered.marksByTraceId
						.get(trace.id)!
						.map((mark) => mark.rowId)
						.filter((id) => scopeIdsInSnapshot.has(id))
				)
			: membership.scopesByTrace.get(trace.id);
		for (const scopeId of scopeIds?.size ? scopeIds : [null]) {
			const group = groupsByScope.get(scopeId) ?? [];
			group.push(item);
			groupsByScope.set(scopeId, group);
		}
	}
	const byTime = (a: PeriodTrace, b: PeriodTrace): number =>
		a.time.start - b.time.start || a.traceId.localeCompare(b.traceId);
	const groups: PeriodScopeGroup[] = snapshot.scopes
		.filter((scope) => groupsByScope.has(scope.id))
		.map((scope) => ({
			scopeId: scope.id,
			name: scope.name,
			traces: groupsByScope.get(scope.id)!.toSorted(byTime)
		}));
	const unscoped = groupsByScope.get(null);
	if (unscoped)
		groups.push({
			scopeId: null,
			name: translate(filters?.language ?? 'ru', UNSCOPED_GROUP_KEY),
			traces: unscoped.toSorted(byTime)
		});
	const record = snapshot.periods.find((item) => matchesPeriod(item, period)) ?? null;
	return {
		period,
		title: periodTitle(period, filters?.language ?? 'ru'),
		record,
		note: record?.note ?? null,
		groups,
		traceCount,
		activeScopeIds: groups.flatMap((group) => (group.scopeId ? [group.scopeId] : [])),
		neighbors: periodNeighbors(period)
	};
};
