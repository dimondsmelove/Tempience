import { describe, expect, it } from 'vitest';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { EMPTY_PROJECTION_STATE } from './constants';
import { projectSnapshot } from './Projection';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const trace = (id: string, patch: Partial<ExplorerTrace> = {}): ExplorerTrace => ({
	id,
	content: `Запись ${id}`,
	relation: 'actual',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-03-10',
		end: null
	},
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin,
	...patch
});
const link = (fromId: string, toId: string, kind: 'belongs_to' | 'revisits') => ({
	id: `${kind}:${fromId}:${toId}`,
	fromId,
	toId,
	kind,
	context: null,
	origin
});

const snapshot: ExplorerSnapshot = {
	scopes: [{ id: 'a', name: 'A', note: null, startedAt: null, endedAt: null, origin }],
	traces: [
		trace('t1'),
		// A new supplement: a reference without its own time, anchored only by revisits.
		trace('s1', { aboutKind: 'trace_ref', aboutTime: null }),
		// A legacy inline reference keeps its parked entry.
		trace('r1', { aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: 't1' }),
		trace('u1', { aboutTime: { basis: 'unknown' } })
	],
	periods: [],
	intersections: [
		link('t1', 'a', 'belongs_to'),
		link('s1', 'a', 'belongs_to'),
		link('r1', 'a', 'belongs_to'),
		link('u1', 'a', 'belongs_to'),
		link('s1', 't1', 'revisits')
	],
	scopeSegments: []
};

describe('projectSnapshot — supplements', () => {
	it('keeps a new supplement off the axis and out of the parked strip, unlike a legacy inline reference', () => {
		const result = projectSnapshot(snapshot, EMPTY_PROJECTION_STATE);
		expect([...result.timeByTraceId.keys()]).toEqual(['t1']);
		expect(result.parked.map((item) => [item.traceId, item.reason])).toEqual([
			['r1', 'trace_ref'],
			['u1', 'unknown']
		]);
		expect(result.counts).toMatchObject({ onAxis: 1, parked: 2 });
		expect(result.links).toContainEqual({ fromTraceId: 's1', toTraceId: 't1', kind: 'revisits' });
	});
});
