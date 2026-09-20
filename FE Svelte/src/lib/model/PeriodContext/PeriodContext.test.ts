import { describe, expect, it } from 'vitest';
import type { ProjectionState } from '$lib/model/Projection/types';
import { periodAt } from '$lib/model/Axis/Axis';
import { parsePeriodTime, periodTimeBounds } from '$lib/state/triplit/period-time';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import {
	periodContext,
	periodDraftTime,
	periodEmphasis,
	periodFade,
	periodNeighbors,
	periodRecordRef,
	notedPeriods
} from './PeriodContext';

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
	colorHue: null,
	colorChroma: null,
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
	it('lists every record of the period once, by time, with its Scopes in rail order', () => {
		const context = periodContext(snapshot, march);
		expect(context.traceCount).toBe(4);
		// t2 is an interval that started before March: it sorts by its start, ahead of t1.
		expect(context.records.map((r) => [r.traceId, r.scopes.map((s) => s.name)])).toEqual([
			['t2', ['Дом']],
			['t1', ['Дом', 'Работа']],
			['t5', []],
			['t3', ['Работа']]
		]);
		expect(context.records.filter((r) => r.traceId === 't1')).toHaveLength(1);
		expect(context.activeScopes).toEqual([
			{ id: 'a', name: 'Дом', colorHue: null, colorChroma: null },
			{ id: 'b', name: 'Работа', colorHue: null, colorChroma: null }
		]);
	});

	it('keeps a record in three Scopes once, its Scopes in rail order with the hue of each', () => {
		const wide: ExplorerSnapshot = {
			...snapshot,
			scopes: [
				{ ...scope('a', 'Дом'), colorHue: 3, colorChroma: 60 },
				scope('b', 'Работа'),
				scope('c', 'Проект')
			],
			intersections: [...snapshot.intersections, belongs('t1', 'c')]
		};
		const context = periodContext(wide, march);
		const t1 = context.records.filter((r) => r.traceId === 't1');
		expect(t1).toHaveLength(1);
		expect(t1[0].scopes).toEqual([
			{ id: 'a', name: 'Дом', colorHue: 3, colorChroma: 60 },
			{ id: 'b', name: 'Работа', colorHue: null, colorChroma: null },
			{ id: 'c', name: 'Проект', colorHue: null, colorChroma: null }
		]);
		expect(context.traceCount).toBe(4);
		expect(context.activeScopes.map((s) => s.id)).toEqual(['a', 'b', 'c']);
	});

	it('lights the records of a hovered Scope and the Scopes of a hovered record, nothing without a focus', () => {
		const { records } = periodContext(snapshot, march);
		expect(periodEmphasis(records, null)).toEqual({ traceIds: new Set(), scopeIds: new Set() });
		// «Дом» has t2 and t1 in March; t5 («Без Scope») and t3 stay as they are.
		expect(periodEmphasis(records, { kind: 'scope', id: 'a' })).toEqual({
			traceIds: new Set(['t2', 't1']),
			scopeIds: new Set()
		});
		expect(periodEmphasis(records, { kind: 'scope', id: 'b' }).traceIds).toEqual(
			new Set(['t1', 't3'])
		);
		// t1 lies in both Scopes: both chips light; t5 has none, so no chip does.
		expect(periodEmphasis(records, { kind: 'trace', id: 't1' })).toEqual({
			traceIds: new Set(),
			scopeIds: new Set(['a', 'b'])
		});
		expect(periodEmphasis(records, { kind: 'trace', id: 't5' }).scopeIds).toEqual(new Set());
		// A Scope or a record that is not in the period lights nothing.
		expect(periodEmphasis(records, { kind: 'scope', id: 'zzz' }).traceIds).toEqual(new Set());
		expect(periodEmphasis(records, { kind: 'trace', id: 't4' }).scopeIds).toEqual(new Set());
	});

	it('finds the persisted Period of the calendar period across the zone offset', () => {
		expect(periodContext(snapshot, march).record?.id).toBe('p-march');
		expect(periodContext(snapshot, march).note).toBe('Заметка марта');
		const week = periodAt(Date.UTC(2026, 2, 11), 'week');
		expect(periodContext(snapshot, week).record?.id).toBe('p-week');
		expect(periodContext(snapshot, periodAt(Date.UTC(2026, 3, 1), 'month')).record).toBeNull();
	});

	it('folds the other Scopes’ records and dims the other chips under a chip; dims the other records under a record (C3, B)', () => {
		const { records, activeScopes } = periodContext(snapshot, march);
		const none = { folded: new Set(), dimmedTraceIds: new Set(), dimmedScopeIds: new Set() };
		expect(periodFade(records, activeScopes, null)).toEqual(none);
		// «Дом» (a) has t2 and t1: t5 («Без Scope») and t3 (Работа only) fold; the chip of Работа dims.
		expect(periodFade(records, activeScopes, { kind: 'scope', id: 'a' })).toEqual({
			folded: new Set(['t5', 't3']),
			dimmedTraceIds: new Set(),
			dimmedScopeIds: new Set(['b'])
		});
		// t1 lies in both Scopes, so it stays under either chip.
		expect(periodFade(records, activeScopes, { kind: 'scope', id: 'b' }).folded).toEqual(
			new Set(['t2', 't5'])
		);
		// A record: every other record dims, nothing folds, no chip dims.
		expect(periodFade(records, activeScopes, { kind: 'trace', id: 't1' })).toEqual({
			folded: new Set(),
			dimmedTraceIds: new Set(['t2', 't5', 't3']),
			dimmedScopeIds: new Set()
		});
	});

	it('reads a persisted Period as the calendar reference the lens tints (C3)', () => {
		const [month, week] = snapshot.periods;
		expect(periodRecordRef(month)).toEqual({
			unit: 'month',
			start: periodTimeBounds(month.time, month.timezone).start,
			end: periodTimeBounds(month.time, month.timezone).end
		});
		// A span of days keeps the day unit; the lens reads only the bounds.
		expect(periodRecordRef(week)?.unit).toBe('day');
		expect(periodRecordRef(week)?.end).toBeGreaterThan(periodRecordRef(week)!.start);
		// A precision the axis has no unit for reads as the nearest one; an unreadable time as nothing.
		expect(
			periodRecordRef({ ...month, time: { precision: 'season', start: '2026-03', end: '2026-05' } })
				?.unit
		).toBe('month');
		expect(periodRecordRef({ ...month, timezone: 'Nowhere/Nowhere' })).toBeNull();
	});

	it('marks the calendar periods whose persisted Period has a note, by bounds, whatever the unit', () => {
		const noted = notedPeriods(snapshot.periods);
		// «Март» has a note; the week Period has none. A month is matched by its bounds, not by its precision.
		expect(noted(march)).toBe(true);
		expect(noted(periodAt(Date.UTC(2026, 3, 1), 'month'))).toBe(false);
		expect(noted(periodAt(Date.UTC(2026, 2, 11), 'week'))).toBe(false);
		expect(noted(periodAt(Date.UTC(2026, 0, 1), 'year'))).toBe(false);
		// A week saved as seven days marks the week cell once it has a note; a blank note marks nothing.
		const [month, week] = snapshot.periods;
		const withWeek = notedPeriods([
			{ ...month, note: '   ' },
			{ ...week, note: 'Неделя' }
		]);
		expect(withWeek(march)).toBe(false);
		expect(withWeek(periodAt(Date.UTC(2026, 2, 11), 'week'))).toBe(true);
		expect(withWeek(periodAt(Date.UTC(2026, 2, 11), 'day'))).toBe(false);
		// An unreadable time marks nothing and breaks nothing.
		expect(notedPeriods([{ ...month, timezone: 'Nowhere/Nowhere' }])(march)).toBe(false);
		expect(notedPeriods([])(march)).toBe(false);
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
	expect(work.records.map((r) => [r.traceId, r.scopes.map((s) => s.id)])).toEqual([
		['t1', ['b']],
		['t3', ['b']]
	]);
	expect(work.activeScopes.map((s) => s.id)).toEqual(['b']);
	expect(work.traceCount).toBe(2);
	expect(work.note).toBe('Заметка марта');
	const hidden = periodContext(snapshot, march, { ...filters, hiddenScopes: new Set(['b']) });
	expect(hidden.activeScopes.map((s) => s.id)).toEqual(['a']);
	expect(hidden.traceCount).toBe(3);
	const intervals = periodContext(snapshot, march, {
		...filters,
		hiddenLegend: new Set(['fact'])
	});
	expect(intervals.records.map((r) => r.traceId)).toEqual(['t2']);
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
	expect(work.activeScopes.map((s) => s.id)).toEqual(['b', 'c']);
	expect(work.traceCount).toBe(3);
	// Direct placement only: the roll-up on «Работа» is hidden, so t2 carries the dot of «Проект».
	expect(work.records.find((r) => r.traceId === 't2')?.scopes.map((s) => s.id)).toEqual(['c']);
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
