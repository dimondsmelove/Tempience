import { describe, expect, it } from 'vitest';
import type { ExplorerIntersection, ExplorerTrace } from '$lib/model/Snapshot/types';
import { buildHierarchy } from '../Hierarchy/Hierarchy';
import { childDateLabel, panelRelations } from './panel';

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
const link = (fromId: string, toId: string): ExplorerIntersection => ({
	id: fromId + toId,
	fromId,
	toId,
	kind: 'part_of',
	context: null,
	origin
});
const dated: ExplorerTrace['aboutTime'] = {
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start: '2026-11-18',
	end: null
};

describe('intention panel projections', () => {
	it('preserves dated child order, labels chips, parents and close suggestion', () => {
		const traces = [
			trace('parent'),
			trace('late', { intentOpen: false }),
			trace('early', { intentOpen: false, aboutTime: dated })
		];
		const links = [link('late', 'parent'), link('early', 'parent')];
		const hierarchy = buildHierarchy(traces, links);
		const parent = panelRelations('parent', hierarchy, traces);
		expect(parent.children.map((child) => child.id)).toEqual(['early', 'late']);
		expect(parent.progress).toEqual({ done: 2, total: 2 });
		expect(parent.closeSuggested).toBe(true);
		expect(childDateLabel(traces[2], 'UTC', 'ru', 'Без даты')).toContain('18');
		expect(childDateLabel(traces[1], 'UTC', 'ru', 'Без даты')).toBe('Без даты');
		expect(panelRelations('early', hierarchy, traces).parents.map((item) => item.content)).toEqual([
			'parent'
		]);
		expect(panelRelations('parent', hierarchy, traces).parents).toEqual([]);
		const closed = [trace('parent', { intentOpen: false }), ...traces.slice(1)];
		expect(panelRelations('parent', buildHierarchy(closed, links), closed).closeSuggested).toBe(
			false
		);
	});
});

describe('panel view history', () => {
	it('moves back and forward and discards the forward branch on navigation', async () => {
		const { openView, moveHistory } = await import('./panel');
		const initial = { views: [], index: -1 };
		const backlog = openView(initial, { kind: 'backlog' });
		const task = openView(backlog, { kind: 'task', id: 'one' });
		const back = moveHistory(task, -1);
		expect(back.index).toBe(0);
		expect(moveHistory(back, 1)).toEqual(task);
		expect(openView(back, { kind: 'done' })).toEqual({
			views: [{ kind: 'backlog' }, { kind: 'done' }],
			index: 1
		});
	});
	it('keeps no repeats when the shown view is opened again', async () => {
		const { openView } = await import('./panel');
		const one = openView({ views: [], index: -1 }, { kind: 'task', id: 'one' });
		expect(openView(one, { kind: 'task', id: 'one' })).toBe(one);
		expect(openView(one, { kind: 'task', id: 'two' }).views).toHaveLength(2);
		expect(openView(one, { kind: 'backlog' }).views).toHaveLength(2);
	});
});
