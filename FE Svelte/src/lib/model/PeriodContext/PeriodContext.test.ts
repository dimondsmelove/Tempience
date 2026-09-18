import { describe, expect, it } from 'vitest';
import type { ProjectionState } from '$lib/model/Projection/types';
import { periodAt } from '$lib/model/Axis/Axis';
import { parsePeriodTime, periodTimeBounds } from '$lib/state/triplit/period-time';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import { periodContext, periodDraftTime, periodNeighbors } from './PeriodContext';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const day = (start: string, end: string | null = null): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end
});
const trace = (
	id: string,
	aboutTime: TraceAboutTime | null,
	aboutKind: 'instant' | 'interval' = 'instant'
) => ({
	id,
	content: `Запись ${id}`,
	relation: 'actual' as const,
	timezone: 'UTC',
	aboutKind,
	aboutTime,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin
});
const belongs = (traceId: string, scopeId: string) => ({
	id: `belongs_to:${traceId}:${scopeId}`,
	fromId: traceId,
	toId: scopeId,
	kind: 'belongs_to' as const,
	context: null,
	origin
});
const scope = (id: string, name: string) => ({
	id,
	name,
	note: null,
	startedAt: null,
	endedAt: null,
	origin
});

const march = periodAt(Date.UTC(2026, 2, 15), 'month');
const snapshot: ExplorerSnapshot = {
	scopes: [scope('a', 'Дом'), scope('b', 'Работа')],
	traces: [
		trace('t1', day('2026-03-03')),
		trace('t2', day('2026-02-20', '2026-03-02'), 'interval'),
		trace('t3', day('2026-03-31')),
		trace('t4', day('2026-04-01')),
		trace('t5', day('2026-03-10')),
		trace('t6', null)
	],
	periods: [
		{
			id: 'p-march',
			name: 'Март',
			time: { precision: 'month', start: '2026-03', end: '2026-03' },
			timezone: 'Europe/Belgrade',
			note: 'Заметка марта',
			origin
		},
		{
			id: 'p-week',
			name: 'Неделя 11',
			time: { precision: 'day', start: '2026-03-09', end: '2026-03-15' },
			timezone: 'Europe/Belgrade',
			note: null,
			origin
		}
	],
	intersections: [belongs('t1', 'a'), belongs('t2', 'a'), belongs('t3', 'b'), belongs('t1', 'b')],
	scopeSegments: []
};

describe('periodContext', () => {
	it('groups the records inside the period by Scope, copies included, unscoped last', () => {
		const context = periodContext(snapshot, march);
		expect(context.traceCount).toBe(4);
		expect(context.groups.map((g) => [g.name, g.traces.map((t) => t.traceId)])).toEqual([
			['Дом', ['t2', 't1']],
			['Работа', ['t1', 't3']],
			['Без Scope', ['t5']]
		]);
		expect(context.activeScopeIds).toEqual(['a', 'b']);
	});

	it('finds the persisted Period of the calendar period across the zone offset', () => {
		expect(periodContext(snapshot, march).record?.id).toBe('p-march');
		expect(periodContext(snapshot, march).note).toBe('Заметка марта');
		const week = periodAt(Date.UTC(2026, 2, 11), 'week');
		expect(periodContext(snapshot, week).record?.id).toBe('p-week');
		expect(periodContext(snapshot, periodAt(Date.UTC(2026, 3, 1), 'month')).record).toBeNull();
	});

	it('walks to the neighbouring, parent and child periods', () => {
		const neighbors = periodNeighbors(march);
		expect(neighbors.previous).toEqual(periodAt(Date.UTC(2026, 1, 1), 'month'));
		expect(neighbors.next).toEqual(periodAt(Date.UTC(2026, 3, 1), 'month'));
		expect(neighbors.parent).toEqual(periodAt(Date.UTC(2026, 0, 1), 'year'));
		expect(neighbors.children.map((c) => c.unit)).toEqual(Array(6).fill('week'));
		expect(periodNeighbors(periodAt(Date.UTC(2026, 2, 11), 'day')).children).toEqual([]);
		expect(periodNeighbors(periodAt(Date.UTC(2026, 0, 1), 'year')).parent).toEqual(
			periodAt(Date.UTC(2026, 0, 1), 'decade')
		);
	});

	it('drafts a PeriodTime the repository accepts for every unit', () => {
		for (const unit of ['day', 'week', 'month', 'year'] as const) {
			const period = periodAt(Date.UTC(2026, 2, 11), unit);
			const time = parsePeriodTime(periodDraftTime(period));
			const bounds = periodTimeBounds(time, 'UTC');
			expect([bounds.start, bounds.end], unit).toEqual([period.start, period.end]);
		}
	});
});

const filters: Omit<ProjectionState, 'expanded'> = {
	grouping: 'scope',
	hiddenScopes: new Set(),
	onlyScopes: null,
	hiddenLegend: new Set(),
	scopeQuery: ''
};

it('shares Scope, legend and search filters while preserving period notes and unique identity', () => {
	const work = periodContext(snapshot, march, { ...filters, scopeQuery: 'Работа' });
	expect(
		work.groups.map((group) => [group.scopeId, group.traces.map((trace) => trace.traceId)])
	).toEqual([['b', ['t1', 't3']]]);
	expect(work.traceCount).toBe(2);
	expect(work.note).toBe('Заметка марта');
	const hidden = periodContext(snapshot, march, { ...filters, hiddenScopes: new Set(['b']) });
	expect(hidden.activeScopeIds).toEqual(['a']);
	expect(hidden.traceCount).toBe(3);
	const intervals = periodContext(snapshot, march, {
		...filters,
		hiddenLegend: new Set(['moment'])
	});
	expect(intervals.groups.flatMap((group) => group.traces.map((trace) => trace.traceId))).toEqual([
		't2'
	]);
	expect(periodContext(snapshot, march, { ...filters, scopeQuery: 'ничего' }).traceCount).toBe(0);
	expect(periodContext(snapshot, march, filters).traceCount).toBe(4);
});

it('reads the whole selected Scope subtree independently of disclosure and row grouping', () => {
	const nested: ExplorerSnapshot = {
		...snapshot,
		scopes: [...snapshot.scopes, scope('c', 'Проект')],
		intersections: [
			...snapshot.intersections,
			{ ...belongs('c', 'b'), kind: 'child_of' },
			belongs('t2', 'c')
		]
	};
	const work = periodContext(nested, march, {
		...filters,
		grouping: 'kind',
		onlyScopes: new Set(['b']),
		scopeQuery: 'Работа',
		hiddenLegend: new Set(['rollup'])
	});
	expect(work.activeScopeIds).toEqual(['b', 'c']);
	expect(work.traceCount).toBe(3);
	expect(work.groups.find((group) => group.scopeId === 'c')?.traces[0].traceId).toBe('t2');
});

it('represents a decade using existing year precision and navigates its ten years', () => {
	const decade = periodAt(Date.UTC(2026, 8, 1), 'decade');
	const time = parsePeriodTime(periodDraftTime(decade));
	expect(time).toEqual({ precision: 'year', start: '2020', end: '2029' });
	expect(periodTimeBounds(time, 'UTC')).toEqual({ start: decade.start, end: decade.end });
	const neighbors = periodNeighbors(decade);
	expect(neighbors.parent).toBeNull();
	expect(neighbors.children).toHaveLength(10);
	expect(neighbors.children[0]).toEqual(periodAt(Date.UTC(2020, 0, 1), 'year'));
	expect(neighbors.next.start).toBe(Date.UTC(2030, 0, 1));
	expect(periodNeighbors(neighbors.children[0]).parent).toEqual(decade);
});
