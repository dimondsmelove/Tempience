import { describe, expect, it } from 'vitest';
import type { ExplorerIntersection, ExplorerTrace } from '$lib/model/Snapshot/types';
import { buildHierarchy, crumbOf, treeRows } from './Hierarchy';
const origin = { kind: 'canonical', sourceId: 'test' } as const;
const trace = (id: string, patch: Partial<ExplorerTrace> = {}): ExplorerTrace => ({
	id,
	content: id,
	relation: 'intend',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: null,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin,
	...patch
});
const link = (
	fromId: string,
	toId: string,
	kind: ExplorerIntersection['kind'] = 'part_of'
): ExplorerIntersection => ({ id: `${fromId}-${toId}`, fromId, toId, kind, context: null, origin });
const dated = (date: string): ExplorerTrace['aboutTime'] => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: date,
	end: null
});
describe('hierarchy', () => {
	it('builds a DAG, sorts children and parents, and derives progress', () => {
		const traces = [
			trace('a'),
			trace('b', { intentOpen: false }),
			trace('z', { intentOpen: false }),
			trace('c', { intentOpen: false, aboutTime: dated('2026-09-20') }),
			trace('d', { intentOpen: false, aboutTime: dated('2026-09-19') }),
			trace('fact', { relation: 'actual' })
		];
		const hierarchy = buildHierarchy(traces, [
			link('z', 'a'),
			link('c', 'a'),
			link('d', 'a'),
			link('c', 'b'),
			link('fact', 'a'),
			link('z', 'fact'),
			link('z', 'missing'),
			link('z', 'a', 'evidence_for')
		]);
		expect(hierarchy.get('a')).toEqual({
			parents: [],
			children: ['d', 'c', 'z'],
			progress: { done: 3, total: 3 },
			closeSuggested: true
		});
		expect(hierarchy.get('c')?.parents).toEqual(['a', 'b']);
		expect(hierarchy.get('b')?.closeSuggested).toBe(false);
		expect(hierarchy.get('z')?.progress).toBeNull();
		expect(hierarchy.has('fact')).toBe(false);
		expect(crumbOf('c', hierarchy, traces)).toEqual({ title: 'a', extra: 1 });
		expect(crumbOf('a', hierarchy, traces)).toBeNull();
		expect(crumbOf('missing', hierarchy, traces)).toBeNull();
	});
	it('ignores cycle-closing edges and keeps partial progress', () => {
		const traces = [trace('a'), trace('b'), trace('c', { intentOpen: false })];
		const hierarchy = buildHierarchy(traces, [
			link('a', 'b'),
			link('b', 'c'),
			link('c', 'a'),
			link('a', 'a')
		]);
		expect(hierarchy.get('c')?.parents).toEqual([]);
		expect(hierarchy.get('b')).toMatchObject({
			children: ['a'],
			progress: { done: 0, total: 1 },
			closeSuggested: false
		});
		expect(treeRows(traces, hierarchy).map(({ trace, level }) => [trace.id, level])).toEqual([
			['c', 0],
			['b', 1],
			['a', 1]
		]);
	});
	it('shows only supplied items once, including descendants and multiple parents', () => {
		const traces = ['root', 'other', 'child', 'grandchild', 'absent', 'orphan'].map((id) =>
			trace(id)
		);
		const hierarchy = buildHierarchy(traces, [
			link('child', 'root'),
			link('child', 'other'),
			link('grandchild', 'child'),
			link('absent', 'root'),
			link('orphan', 'absent')
		]);
		const items = traces.filter((item) => item.id !== 'absent');
		expect(treeRows(items, hierarchy).map(({ trace, level }) => [trace.id, level])).toEqual([
			['root', 0],
			['child', 1],
			['grandchild', 1],
			['other', 0],
			['orphan', 0]
		]);
	});
});
