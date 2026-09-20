import { floorUnit, nextUnit, periodAt, periodTitle, prevUnit } from '$lib/model/Axis/Axis';
import type { AxisUnit, PeriodRef } from '$lib/model/Axis/types';
import { projectSnapshot } from '$lib/model/Projection/Projection';
import type { ProjectionState } from '$lib/model/Projection/types';
import { traceMarkTime } from '$lib/model/Projection/marks';
import { scopeMembership } from '$lib/model/Projection/tree';
import { periodTimeBounds, type PeriodTimeBounds } from '$lib/state/triplit/period-time';
import type { PeriodTime, TemporalPrecision } from '$lib/state/triplit/types';
import type { ExplorerPeriod, ExplorerScope, ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { BOUNDS_TOLERANCE_MS, CHILD_UNIT, PARENT_UNIT } from './constants';
import type {
	PeriodContext,
	PeriodEmphasis,
	PeriodFade,
	PeriodFocus,
	PeriodNeighbors,
	PeriodRecord,
	PeriodScope
} from './types';

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

/** The calendar unit a persisted Period's precision reads as on the axis: a minute is a day, a season a month. */
const UNIT_OF: Readonly<Record<TemporalPrecision, AxisUnit>> = {
	minute: 'day',
	day: 'day',
	month: 'month',
	season: 'month',
	year: 'year'
};

/**
 * A persisted Period as a calendar reference, by its time: what the lens tints for it (loop
 * 008, C3). Null when its time cannot be read.
 */
export const periodRecordRef = (record: ExplorerPeriod): PeriodRef | null => {
	try {
		const bounds = periodTimeBounds(record.time, record.timezone);
		return { unit: UNIT_OF[record.time.precision], start: bounds.start, end: bounds.end };
	} catch {
		return null;
	}
};

/** A persisted Period's bounds and a calendar period agree within the zone offset (`BOUNDS_TOLERANCE_MS`). */
const sameBounds = (bounds: PeriodTimeBounds, period: PeriodRef): boolean =>
	Math.abs(bounds.start - period.start) <= BOUNDS_TOLERANCE_MS &&
	Math.abs(bounds.end - period.end) <= BOUNDS_TOLERANCE_MS;

const matchesPeriod = (record: ExplorerPeriod, period: PeriodRef): boolean => {
	try {
		return sameBounds(periodTimeBounds(record.time, record.timezone), period);
	} catch {
		return false;
	}
};

/**
 * Which calendar periods carry a note (loop 008 polish, owner 2026-09-20): a matcher over the
 * persisted Periods by their bounds, whatever the unit — a week saved as seven days is the
 * week's. Built once per snapshot: the axis asks it for every cell of every row, the period's
 * Окрестность for its neighbours. A Period whose time cannot be read marks nothing.
 */
export const notedPeriods = (
	periods: readonly ExplorerPeriod[]
): ((period: PeriodRef) => boolean) => {
	const noted: PeriodTimeBounds[] = [];
	for (const record of periods) {
		if (!record.note?.trim()) continue;
		try {
			noted.push(periodTimeBounds(record.time, record.timezone));
		} catch {
			// An unreadable time: the note stays in the Context, the axis shows no bar.
		}
	}
	return (period) => noted.some((bounds) => sameBounds(bounds, period));
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

const periodScope = (scope: ExplorerScope): PeriodScope => ({
	id: scope.id,
	name: scope.name,
	colorHue: scope.colorHue,
	colorChroma: scope.colorChroma,
	colorDepth: scope.colorDepth
});

const NONE: ReadonlySet<string> = new Set();
const NO_EMPHASIS: PeriodEmphasis = { traceIds: NONE, scopeIds: NONE };

/**
 * Hover linking of the period (owner review 2026-09-19, п. 26): an active-Scope chip under
 * the pointer or the focus lights the records that belong to that Scope; a record lights
 * the chips of its Scopes. Nothing else changes and nothing dims; no focus lights nothing.
 */
export const periodEmphasis = (
	records: readonly PeriodRecord[],
	focus: PeriodFocus
): PeriodEmphasis => {
	if (focus === null) return NO_EMPHASIS;
	if (focus.kind === 'scope') {
		const traceIds = records
			.filter((record) => record.scopes.some((scope) => scope.id === focus.id))
			.map((record) => record.traceId);
		return { traceIds: new Set(traceIds), scopeIds: new Set() };
	}
	const record = records.find((item) => item.traceId === focus.id);
	return { traceIds: new Set(), scopeIds: new Set(record?.scopes.map((scope) => scope.id)) };
};

const NO_FADE: PeriodFade = { folded: NONE, dimmedTraceIds: NONE, dimmedScopeIds: NONE };

/**
 * What gives way under the focus (loop 008, C3, B; owner 2026-09-19): a chip leaves only its
 * Scope's records in the list — the others fold away — and dims the other chips; a record
 * dims the other records and leaves the chips as the emphasis lights them. No focus, nothing.
 */
export const periodFade = (
	records: readonly PeriodRecord[],
	scopes: readonly PeriodScope[],
	focus: PeriodFocus
): PeriodFade => {
	if (focus === null) return NO_FADE;
	if (focus.kind === 'scope') {
		return {
			folded: new Set(
				records
					.filter((record) => !record.scopes.some((scope) => scope.id === focus.id))
					.map((record) => record.traceId)
			),
			dimmedTraceIds: NONE,
			dimmedScopeIds: new Set(scopes.filter((scope) => scope.id !== focus.id).map((s) => s.id))
		};
	}
	return {
		folded: NONE,
		dimmedTraceIds: new Set(
			records.filter((record) => record.traceId !== focus.id).map((record) => record.traceId)
		),
		dimmedScopeIds: NONE
	};
};

/**
 * What the Context shows for a calendar period (DESIGN.md §8): its persisted
 * note, the records inside it once each with their Scopes, the Scopes that
 * are active in it and the neighbouring periods. Pure over the snapshot.
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
	const membership = scopeMembership(snapshot.traces, snapshot.scopes, snapshot.intersections);
	const records: PeriodRecord[] = [];
	const activeIds = new Set<string>();
	for (const trace of snapshot.traces) {
		if (filtered && !filtered.marksByTraceId.has(trace.id)) continue;
		const time = traceMarkTime(trace);
		if (!time || time.end < period.start || time.start >= period.end) continue;
		const scopeIds = filtered
			? new Set(filtered.marksByTraceId.get(trace.id)!.map((mark) => mark.rowId))
			: membership.scopesByTrace.get(trace.id);
		// One record per trace: its Scopes are kept in rail order for the hover linking, never copies.
		const scopes = snapshot.scopes.filter((scope) => scopeIds?.has(scope.id)).map(periodScope);
		for (const scope of scopes) activeIds.add(scope.id);
		records.push({ traceId: trace.id, label: trace.content, time, scopes });
	}
	records.sort((a, b) => a.time.start - b.time.start || a.traceId.localeCompare(b.traceId));
	const record = snapshot.periods.find((item) => matchesPeriod(item, period)) ?? null;
	return {
		period,
		title: periodTitle(period, filters?.language ?? 'ru'),
		record,
		note: record?.note ?? null,
		records,
		traceCount: records.length,
		activeScopes: snapshot.scopes.filter((scope) => activeIds.has(scope.id)).map(periodScope),
		neighbors: periodNeighbors(period)
	};
};
