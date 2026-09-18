import { describe, expect, it } from 'vitest';
import type { ExplorerScope, ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { scopeContext } from './ScopeContext';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const scope = (id: string): ExplorerScope => ({
	id,
	name: id,
	note: null,
	startedAt: null,
	endedAt: null,
	origin
});
const snapshot: ExplorerSnapshot = {
	scopes: [
		{ ...scope('parent'), startedAt: '2025-01-01', endedAt: '2027-01-01' },
		scope('child'),
		scope('empty')
	],
	traces: [
		{
			id: 'trace',
			content: 'Record',
			relation: 'actual',
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-03-01',
				end: null
			},
			aboutTraceId: null,
			kindId: null,
			kindVId: null,
			data: null,
			origin
		}
	],
	intersections: [
		{ id: 'hierarchy', fromId: 'child', toId: 'parent', kind: 'child_of', context: null, origin },
		...['parent', 'child'].map((toId) => ({
			id: toId,
			fromId: 'trace',
			toId,
			kind: 'belongs_to' as const,
			context: null,
			origin
		}))
	],
	periods: [],
	scopeSegments: [
		{
			id: 'segment',
			scopeId: 'child',
			startAt: '2024-01-01',
			endAt: '2024-02-01',
			label: null,
			position: 0,
			origin
		}
	]
};

describe('scopeContext', () => {
	it('deduplicates subtree records and fits declared bounds, segments and record time', () => {
		const context = scopeContext(snapshot, 'parent')!;
		expect(context.traces.map((item) => item.record.id)).toEqual(['trace']);
		expect(context.parent).toBeNull();
		expect(context.children.map((item) => item.id)).toEqual(['child']);
		expect(context.range).toEqual({
			start: Date.parse('2024-01-01'),
			end: Date.parse('2027-01-01')
		});
		const child = scopeContext(snapshot, 'child')!;
		expect(child.parent?.id).toBe('parent');
		expect(child.range?.start).toBe(Date.parse('2024-01-01'));
		expect(child.range?.end).toBe(child.traces[0].time?.end);
	});
	it('does not invent a range for an undated empty Scope or a missing Scope', () => {
		expect(scopeContext(snapshot, 'empty')?.range).toBeNull();
		expect(scopeContext(snapshot, 'empty')?.traces).toEqual([]);
		expect(scopeContext(snapshot, 'missing')).toBeNull();
	});
});
