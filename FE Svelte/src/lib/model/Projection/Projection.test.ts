import { describe, expect, it } from 'vitest';
import type {
	ExplorerIntersection,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import type { TraceAboutTime, TraceRelation } from '$lib/state/triplit/types';
import { EMPTY_PROJECTION_STATE, UNSCOPED_ROW_ID } from './constants';
import { traceMarkTime } from './marks';
import { countInWindow, projectSnapshot } from './Projection';
import type { ProjectionState } from './types';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const scope = (id: string): ExplorerScope => ({
	id,
	name: id.toUpperCase(),
	note: null,
	startedAt: null,
	endedAt: null,
	origin
});
const trace = (
	id: string,
	aboutKind: ExplorerTrace['aboutKind'],
	aboutTime: TraceAboutTime | null,
	relation: TraceRelation = 'actual'
): ExplorerTrace => ({
	id,
	content: `Запись ${id}`,
	relation,
	timezone: 'UTC',
	aboutKind,
	aboutTime,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin
});
const link = (fromId: string, toId: string, kind: ExplorerIntersection['kind']) => ({
	id: `${kind}:${fromId}:${toId}`,
	fromId,
	toId,
	kind,
	context: null,
	origin
});
const absolute = (
	start: string,
	precision: 'minute' | 'day' | 'month' | 'year' = 'day',
	end: string | null = null,
	certainty: 'exact' | 'approximate' = 'exact'
): TraceAboutTime => ({ basis: 'absolute', precision, certainty, start, end });

const snapshot: ExplorerSnapshot = {
	scopes: [scope('a'), scope('b'), scope('c')],
	traces: [
		trace('t1', 'instant', absolute('2026-03-10')),
		trace('t2', 'interval', absolute('2026-03-01', 'day', '2026-03-05')),
		trace('t3', 'instant', absolute('2026-04', 'month')),
		trace('t4', 'instant', absolute('2026-05-01'), 'intend'),
		trace('t5', 'instant', {
			basis: 'relative',
			precision: 'day',
			anchorTraceId: 't1',
			relation: 'after'
		}),
		trace('t6', 'instant', absolute('2026-06-01')),
		trace('t7', 'instant', absolute('2026-03-12T10:30:00.000Z', 'minute', null, 'approximate'))
	],
	periods: [],
	intersections: [
		link('b', 'a', 'child_of'),
		link('t1', 'a', 'belongs_to'),
		link('t2', 'a', 'belongs_to'),
		link('t2', 'b', 'belongs_to'),
		link('t3', 'b', 'belongs_to'),
		link('t4', 'a', 'belongs_to'),
		link('t5', 'b', 'belongs_to'),
		link('t7', 'b', 'belongs_to'),
		link('t6', 't1', 'evidence_for')
	],
	scopeSegments: []
};
const state = (patch: Partial<ProjectionState> = {}): ProjectionState => ({
	...EMPTY_PROJECTION_STATE,
	...patch
});

describe('traceMarkTime', () => {
	it('classifies moments, intervals, fuzzy dates and intents', () => {
		expect(traceMarkTime(snapshot.traces[0])).toMatchObject({ kind: 'moment', intent: false });
		expect(traceMarkTime(snapshot.traces[1])).toMatchObject({ kind: 'interval' });
		expect(traceMarkTime(snapshot.traces[2])).toMatchObject({ kind: 'fuzzy', precision: 'month' });
		expect(traceMarkTime(snapshot.traces[3])).toMatchObject({ kind: 'moment', intent: true });
		expect(traceMarkTime(snapshot.traces[4])).toBeNull();
		expect(traceMarkTime(snapshot.traces[6])).toMatchObject({
			kind: 'fuzzy',
			certainty: 'approximate'
		});
	});

	it('centres a day-precision moment in its day and keeps a minute exact', () => {
		const day = traceMarkTime(snapshot.traces[0])!;
		expect(day.start).toBe(Date.UTC(2026, 2, 10, 12));
		expect(day.end).toBe(day.start);
		const minute = traceMarkTime(
			trace('m', 'instant', absolute('2026-03-12T10:30:00.000Z', 'minute'))
		)!;
		expect(minute.start).toBe(Date.UTC(2026, 2, 12, 10, 30));
	});
});

describe('projectSnapshot', () => {
	it('keeps a user Kind off the rows and the parked list until it is chosen, without changing the snapshot', () => {
		const typed = {
			...snapshot,
			traces: snapshot.traces.map((trace) =>
				['t2', 't5'].includes(trace.id) ? { ...trace, kindId: 'measurement' } : trace
			)
		};
		for (const grouping of ['scope', 'kind'] as const) {
			const result = projectSnapshot(
				typed,
				state({
					grouping,
					expanded: new Set(['a', 'b'])
				})
			);
			expect(result.marksByTraceId.has('t2')).toBe(false);
			expect(result.parked.some((trace) => trace.traceId === 't5')).toBe(false);
			expect(result.marksByTraceId.has('t1')).toBe(true);
		}
		const collapsed = projectSnapshot(typed, state());
		expect(collapsed.marksByTraceId.has('t2')).toBe(false);
		expect(typed.traces).toHaveLength(snapshot.traces.length);
		const restored = projectSnapshot(typed, state({ shownKindIds: new Set(['measurement']) }));
		expect(restored.marksByTraceId.has('t2')).toBe(true);
		expect(restored.parked.some((trace) => trace.traceId === 't5')).toBe(true);
	});

	it('rolls a collapsed group up, deduplicates by traceId and keeps empty scopes as rows', () => {
		const projection = projectSnapshot(snapshot, state());
		expect(projection.rows.map((row) => row.id)).toEqual(['a', 'c', UNSCOPED_ROW_ID]);
		const a = projection.rows[0];
		expect(a).toMatchObject({
			hasChildren: true,
			expanded: false,
			directCount: 3,
			subtreeCount: 5
		});
		const byTrace = Object.fromEntries(a.marks.map((mark) => [mark.traceId, mark.rollup]));
		expect(byTrace).toEqual({ t1: false, t2: false, t4: false, t3: true, t7: true });
		expect(a.range).toEqual({ start: Date.UTC(2026, 2, 1), end: Date.UTC(2026, 4, 1, 12) });
		expect(projection.rows[1]).toMatchObject({
			id: 'c',
			directCount: 0,
			subtreeCount: 0,
			marks: []
		});
		expect(projection.rows[2]).toMatchObject({ kind: 'unscoped', directCount: 1 });
	});

	it('shows only direct records once a group is expanded', () => {
		const projection = projectSnapshot(snapshot, state({ expanded: new Set(['a']) }));
		expect(projection.rows.map((row) => row.id)).toEqual(['a', 'b', 'c', UNSCOPED_ROW_ID]);
		expect(projection.rows[0].marks.map((mark) => mark.traceId).sort()).toEqual(['t1', 't2', 't4']);
		expect(projection.rows[1]).toMatchObject({ depth: 1, directCount: 3, subtreeCount: 3 });
		expect(projection.marksByTraceId.get('t2')?.map((mark) => mark.rowId)).toEqual(['a', 'b']);
	});

	it('applies the legend, hidden scopes and «only these» filters', () => {
		const legend = projectSnapshot(
			snapshot,
			state({ hiddenLegend: new Set(['intent', 'rollup']) })
		);
		expect(legend.rows[0].marks.map((mark) => mark.traceId).sort()).toEqual(['t1', 't2']);
		expect(legend.rows[0].range?.start).toBe(Date.UTC(2026, 2, 1));

		const hidden = projectSnapshot(snapshot, state({ hiddenScopes: new Set(['b']) }));
		expect(hidden.rows[0]).toMatchObject({ hasChildren: false, subtreeCount: 3 });
		expect(hidden.rows[0].marks.some((mark) => mark.rollup)).toBe(false);

		const only = projectSnapshot(
			snapshot,
			state({ onlyScopes: new Set(['b']), expanded: new Set(['a']) })
		);
		expect(only.rows.map((row) => row.id)).toEqual(['a', 'b']);
	});

	it('parks records without an absolute time and counts the rest', () => {
		const projection = projectSnapshot(snapshot, state());
		expect(projection.parked).toEqual([
			{ traceId: 't5', label: 'Запись t5', reason: 'relative', scopeIds: ['b'] }
		]);
		expect(projection.counts).toEqual({ rows: 3, onAxis: 6, intents: 1, proposals: 0, parked: 1 });
		expect(projection.extent).toEqual({
			start: Date.UTC(2026, 2, 1),
			end: Date.UTC(2026, 5, 1, 12)
		});
		expect(projection.links).toEqual([
			{ fromTraceId: 't6', toTraceId: 't1', kind: 'evidence_for' }
		]);
		expect(
			countInWindow(projection, { start: Date.UTC(2026, 2, 1), end: Date.UTC(2026, 2, 31) })
		).toBe(3);
	});
	it('searches names, reveals the matching branch and excludes unrelated ancestor records', () => {
		const saved = new Set<string>();
		const result = projectSnapshot(snapshot, state({ scopeQuery: ' b ', expanded: saved }));
		expect(result.rows.map((row) => row.id)).toEqual(['a', 'b']);
		expect(result.rows[0]).toMatchObject({ expanded: true, directCount: 0, subtreeCount: 3 });
		expect(result.rows[1].marks.map((mark) => mark.traceId)).toEqual(['t2', 't3', 't7']);
		expect(result.parked.map((trace) => trace.traceId)).toEqual(['t5']);
		expect(saved.size).toBe(0);
		expect(projectSnapshot(snapshot, state({ expanded: saved })).rows.map((row) => row.id)).toEqual(
			['a', 'c', UNSCOPED_ROW_ID]
		);
	});

	it('includes descendants of a matching name and combines search with hidden and only filters', () => {
		const branch = projectSnapshot(snapshot, state({ scopeQuery: 'A' }));
		expect(branch.rows.map((row) => row.id)).toEqual(['a', 'b']);
		expect(branch.rows[0]).toMatchObject({ expanded: true, directCount: 3, subtreeCount: 5 });
		const hidden = projectSnapshot(
			snapshot,
			state({ scopeQuery: 'b', hiddenScopes: new Set(['a']) })
		);
		expect(hidden.rows).toEqual([]);
		expect(hidden.parked).toEqual([]);
		const only = projectSnapshot(snapshot, state({ scopeQuery: 'b', onlyScopes: new Set(['c']) }));
		expect(only.rows).toEqual([]);
		expect(only.parked).toEqual([]);
	});

	it('filters parked records through visible memberships, including hidden ancestors', () => {
		const hidden = projectSnapshot(snapshot, state({ hiddenScopes: new Set(['a']) }));
		expect(hidden.parked).toEqual([]);
		const shared = {
			...snapshot,
			intersections: [...snapshot.intersections, link('t5', 'c', 'belongs_to')]
		};
		const result = projectSnapshot(shared, state({ hiddenScopes: new Set(['a']) }));
		expect(result.parked.map((trace) => trace.traceId)).toEqual(['t5']);
		expect(result.rows.find((row) => row.id === 'c')).toMatchObject({ directCount: 0 });
	});

	it('returns an empty result for a name miss, without searching record content', () => {
		const result = projectSnapshot(snapshot, state({ scopeQuery: 'Запись' }));
		expect(result.rows).toEqual([]);
		expect(result.parked).toEqual([]);
		expect(result.timeByTraceId.size).toBe(6);
	});
	it('groups each record once by temporal kind while preserving intent and Scope filters', () => {
		const result = projectSnapshot(snapshot, state({ grouping: 'kind', expanded: new Set(['a']) }));
		expect(result.rows.map((row) => row.name)).toEqual(['Моменты', 'Интервалы', 'Неточные даты']);
		expect(result.rows.map((row) => row.directCount)).toEqual([3, 1, 2]);
		expect([...result.marksByTraceId.values()].every((marks) => marks.length === 1)).toBe(true);
		expect(result.marksByTraceId.get('t4')?.[0]).toMatchObject({
			kind: 'moment',
			intent: true,
			rollup: false
		});
		expect(result.rows.every((row) => row.range === null)).toBe(true);
		const search = projectSnapshot(snapshot, state({ grouping: 'kind', scopeQuery: 'b' }));
		expect(search.rows.map((row) => row.kind)).toEqual(['interval', 'fuzzy']);
		expect([...search.marksByTraceId.keys()].sort()).toEqual(['t2', 't3', 't7']);
		expect(search.parked.map((trace) => trace.traceId)).toEqual(['t5']);
	});

	it('uses the legend for kind rows without duplicating or clearing their counts', () => {
		const result = projectSnapshot(
			snapshot,
			state({
				grouping: 'kind',
				hiddenLegend: new Set(['moment', 'rollup']),
				hiddenScopes: new Set(['b'])
			})
		);
		expect(result.rows.map((row) => row.kind)).toEqual(['moment', 'interval']);
		expect(result.rows[0]).toMatchObject({ directCount: 3, marks: [] });
		expect([...result.marksByTraceId.keys()]).toEqual(['t2']);
		expect(result.parked).toEqual([]);
	});
	it('keeps an entirely parked result accessible when kind rows have no absolute records', () => {
		const parkedOnly = { ...snapshot, traces: [snapshot.traces[4]] };
		const result = projectSnapshot(parkedOnly, state({ grouping: 'kind', scopeQuery: 'b' }));
		expect(result.rows).toEqual([]);
		expect(result.parked.map((trace) => trace.traceId)).toEqual(['t5']);
		expect(result.counts).toMatchObject({ onAxis: 0, parked: 1 });
	});
});
