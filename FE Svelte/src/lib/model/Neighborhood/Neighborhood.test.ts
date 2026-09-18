import { describe, expect, it } from 'vitest';
import type {
	ExplorerIntersection,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import { neighborhood, traceLinks } from './Neighborhood';

const origin = { kind: 'canonical' as const, sourceId: 'src-1' };
const scope = (id: string): ExplorerScope => ({
	id,
	name: id.toUpperCase(),
	note: null,
	startedAt: null,
	endedAt: null,
	origin
});
const day = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end: null
});
const trace = (
	id: string,
	aboutTime: TraceAboutTime | null,
	sourceId = origin.sourceId
): ExplorerTrace => ({
	id,
	content: `Запись ${id}`,
	relation: 'actual',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin: { ...origin, sourceId }
});
const link = (fromId: string, toId: string, kind: ExplorerIntersection['kind']) => ({
	id: `${kind}:${fromId}:${toId}`,
	fromId,
	toId,
	kind,
	context: null,
	origin
});

// Scope a: t1 … t8 across March; scope b: t9 (linked to t5) and t10; t11 has no time and points at t5.
const snapshot: ExplorerSnapshot = {
	scopes: [scope('a'), scope('b')],
	traces: [
		trace('t1', day('2026-03-01')),
		trace('t2', day('2026-03-02')),
		trace('t3', day('2026-03-03')),
		trace('t4', day('2026-03-04')),
		trace('t5', day('2026-03-05')),
		trace('t6', day('2026-03-05'), 'src-2'),
		trace('t7', day('2026-03-09')),
		trace('t8', day('2026-03-20')),
		trace('t9', day('2026-03-06')),
		trace('t10', day('2026-03-07')),
		trace('t11', { basis: 'relative', precision: 'day', anchorTraceId: 't5', relation: 'after' })
	],
	periods: [],
	intersections: [
		...['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'].map((id) => link(id, 'a', 'belongs_to')),
		link('t9', 'b', 'belongs_to'),
		link('t10', 'b', 'belongs_to'),
		link('t11', 'b', 'belongs_to'),
		link('t5', 't9', 'related_to'),
		link('t3', 't5', 'evidence_for')
	],
	scopeSegments: []
};

describe('neighborhood', () => {
	it('takes up to radius records on each side within the anchor Scopes, oldest first', () => {
		const result = neighborhood(snapshot, 't5', { radius: 2, filter: 'these' });
		expect(result?.before.map((n) => n.traceId)).toEqual(['t3', 't4']);
		expect(result?.after.map((n) => n.traceId)).toEqual(['t6', 't7']);
		expect(result?.anchorScopeIds).toEqual(['a']);
	});

	it('widens to every Scope with the «Во всех» filter', () => {
		const result = neighborhood(snapshot, 't5', { radius: 2, filter: 'all' });
		expect(result?.after.map((n) => n.traceId)).toEqual(['t6', 't9']);
	});

	it('explains every neighbour: links, same day or distance, shared Scope and source', () => {
		const result = neighborhood(snapshot, 't5', { radius: 5, filter: 'all' })!;
		const byId = new Map([...result.before, ...result.after].map((n) => [n.traceId, n.reasons]));
		expect(byId.get('t6')).toEqual([{ kind: 'sameDay' }, { kind: 'sharedScope', scopeIds: ['a'] }]);
		expect(byId.get('t3')).toEqual([
			{ kind: 'link', link: 'evidence_for', direction: 'incoming' },
			{ kind: 'distance', days: 2 },
			{ kind: 'sharedScope', scopeIds: ['a'] },
			{ kind: 'sharedSource', sourceId: 'src-1' }
		]);
		expect(byId.get('t9')).toEqual([
			{ kind: 'link', link: 'related_to', direction: 'outgoing' },
			{ kind: 'distance', days: 1 },
			{ kind: 'sharedSource', sourceId: 'src-1' }
		]);
	});

	it('keeps linked records outside the temporal window, including ones without time', () => {
		const result = neighborhood(snapshot, 't5', { radius: 1, filter: 'these' })!;
		expect(result.before.map((n) => n.traceId)).toEqual(['t4']);
		expect(result.linked.map((n) => n.traceId).toSorted()).toEqual(['t11', 't3', 't9']);
		expect(result.linked.find((n) => n.traceId === 't11')?.reasons).toEqual([
			{ kind: 'link', link: 'temporal_anchor', direction: 'incoming' },
			{ kind: 'sharedSource', sourceId: 'src-1' }
		]);
	});

	it('gives an anchor without time only its links', () => {
		const result = neighborhood(snapshot, 't11')!;
		expect(result.anchorTime).toBeNull();
		expect(result.before).toEqual([]);
		expect(result.after).toEqual([]);
		expect(result.linked.map((n) => n.traceId)).toEqual(['t5']);
	});

	it('returns null for an unknown anchor and lists record links once', () => {
		expect(neighborhood(snapshot, 'nope')).toBeNull();
		expect(
			traceLinks(snapshot)
				.map((l) => l.kind)
				.toSorted()
		).toEqual(['evidence_for', 'related_to', 'temporal_anchor']);
	});
});
