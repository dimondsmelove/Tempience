import { addDaysISO, buildLifeWeeks, weekStartISO, type LifeWeekCell } from '@chronograph/shared';
import type { Scope, ScopeSegment, Trace } from '$lib/state/triplit';
import { traceAboutTimeBounds } from '$lib/state/triplit/trace-time';
import type { LifePeriod, LifeScale } from './navigation';

export type LocalScopeInterval = {
	startAt: string | null;
	endAt: string | null;
};

export type LocalLifeProjection = {
	range: {
		fromWeekStart: string;
		toWeekStart: string;
	};
	currentWeekStart: string;
	weeks: LifeWeekCell[];
	traceWeekStarts: Set<string>;
	scopeIntervals: Map<string, LocalScopeInterval[]>;
	scopes: Scope[];
};

export const traceBounds = (trace: Trace): { start: number; end: number } | null =>
	traceAboutTimeBounds(trace.aboutKind, trace.aboutTime, trace.statedDuration);

const overlapsWeek = (bounds: { start: number; end: number }, weekStart: string): boolean => {
	const from = Date.parse(`${weekStart}T00:00:00.000Z`);
	const to = from + 7 * 24 * 60 * 60 * 1000;
	return bounds.start < to && bounds.end > from;
};

export const weekStartsForBounds = (
	bounds: { start: number; end: number },
	fromWeek: string,
	toWeek: string
): Set<string> => {
	const weeks = new Set<string>();
	for (let week = fromWeek; week <= toWeek; week = addDaysISO(week, 7)) {
		if (overlapsWeek(bounds, week)) weeks.add(week);
	}
	return weeks;
};

export const weekStartsForIntervals = (
	intervals: LocalScopeInterval[],
	fromWeek: string,
	toWeek: string
): Set<string> => {
	const weeks = new Set<string>();
	for (const interval of intervals) {
		if (!interval.startAt) continue;
		const start = Date.parse(interval.startAt);
		const end = interval.endAt ? Date.parse(interval.endAt) : Date.parse(`${toWeek}T23:59:59.999Z`);
		if (Number.isNaN(start) || Number.isNaN(end) || end <= start) continue;
		for (const week of weekStartsForBounds({ start, end }, fromWeek, toWeek)) weeks.add(week);
	}
	return weeks;
};

const scopeIntervals = (
	scopes: Scope[],
	segments: ScopeSegment[]
): Map<string, LocalScopeInterval[]> => {
	const result = new Map<string, LocalScopeInterval[]>();
	for (const scope of scopes) {
		const scopeSegments = segments
			.filter((segment) => segment.scopeId === scope.id && segment.startAt !== null)
			.toSorted((a, b) => a.position - b.position);
		result.set(
			scope.id,
			scopeSegments.length > 0
				? scopeSegments.map((segment) => ({ startAt: segment.startAt, endAt: segment.endAt }))
				: [{ startAt: scope.startedAt, endAt: scope.endedAt }]
		);
	}
	return result;
};

export const buildLocalLifeProjection = (
	period: LifePeriod,
	traces: Trace[],
	scopes: Scope[],
	segments: ScopeSegment[],
	anchorDate = new Date().toISOString().slice(0, 10)
): LocalLifeProjection => {
	const fromWeekStart = weekStartISO(period.from);
	const toWeekStart = weekStartISO(period.to);
	const currentWeekStart = weekStartISO(anchorDate);
	const weeks = buildLifeWeeks({
		birthDate: period.from,
		horizonDate: period.to,
		currentWeekStart,
		fromWeek: fromWeekStart,
		toWeek: toWeekStart
	});
	const traceWeekStarts = new Set<string>();

	for (const trace of traces) {
		if (trace.isDeleted) continue;
		const bounds = traceBounds(trace);
		if (!bounds) continue;
		for (const week of weekStartsForBounds(bounds, fromWeekStart, toWeekStart)) {
			traceWeekStarts.add(week);
		}
	}

	return {
		range: { fromWeekStart, toWeekStart },
		currentWeekStart,
		weeks,
		traceWeekStarts,
		scopeIntervals: scopeIntervals(scopes, segments),
		scopes
	};
};

export const scopeWeekStarts = (
	projection: LocalLifeProjection,
	scopeId: string,
	includeFuture: boolean
): Set<string> => {
	const weeks = weekStartsForIntervals(
		projection.scopeIntervals.get(scopeId) ?? [],
		projection.range.fromWeekStart,
		projection.range.toWeekStart
	);
	if (includeFuture) return weeks;
	return new Set([...weeks].filter((week) => week <= projection.currentWeekStart));
};

export const filledKeysForWeeks = (weeks: Iterable<string>, scale: LifeScale): Set<string> => {
	const keys = new Set<string>();
	for (const week of weeks) {
		if (scale === 'week') keys.add(week);
		else if (scale === 'month') keys.add(week.slice(0, 7));
		else if (scale === 'year') keys.add(week.slice(0, 4));
		else keys.add(`${Math.floor(Number(week.slice(0, 4)) / 10) * 10}s`);
	}
	return keys;
};
