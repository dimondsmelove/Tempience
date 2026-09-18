import { describe, expect, it } from 'vitest';
import type { KindIndexRow } from '$lib/state/triplit/trace-dataset';
import type { TraceKindV } from '$lib/state/triplit/types';
import { KindHistoryState } from './KindHistory.svelte';
import { PAGE_SIZE } from './constants';

const version = (id: string, generation: number): TraceKindV => ({
	id,
	kindId: 'kind',
	generation,
	parentKindVIds: [],
	dataSchema: { type: 'object', properties: {} },
	uiSchema: {},
	fieldMeta: {},
	createdAt: `2026-0${generation}-01T00:00:00.000Z`,
	createdByDeviceId: 'test'
});

const rows = (kindVId: string, count: number): KindIndexRow[] =>
	Array.from({ length: count }, (_, index) => {
		const key = new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString();
		const start = Date.parse(key);
		return {
			id: `${kindVId}-${index}`,
			kindVId,
			key,
			span: { start, end: start + 60_000 },
			capturedAt: key
		};
	});

describe('the history of a Kind as the user left it', () => {
	it('subscribes the index with the Scope and value filters only, and pages what it answered', () => {
		const history = new KindHistoryState('kind');
		expect(history.indexRequest).toEqual({ kindId: 'kind' });
		history.setFilters({
			scope: { id: 'health', mode: 'subtree' },
			values: [{ path: ['weight'], expectedType: 'number', operator: '>', value: 70 }],
			from: '2026-01-01',
			to: ''
		});
		expect(history.indexRequest).toEqual({
			kindId: 'kind',
			scope: { id: 'health', mode: 'subtree' },
			filters: [{ path: ['weight'], expectedType: 'number', operator: '>', value: 70 }]
		});
		expect(history.activeFilters).toBe(3);
		history.index = {
			kindId: 'kind',
			resolvedScopeIds: ['health'],
			status: 'ready',
			rows: rows('v2', PAGE_SIZE + 3)
		};
		expect(history.rowsOf('v2').dated).toHaveLength(PAGE_SIZE + 3);
		history.setPage('v2', 'dated', 1);
		expect(history.pagesOf('v2')).toEqual({ dated: 1, undated: 0, undatedOpen: false });
		// The rows shrank under the page kept: the page is the last one there is.
		history.index = { ...history.index, rows: rows('v2', 2) };
		expect(history.pagesOf('v2').dated).toBe(0);
	});

	it('shows the versions named, newest first, and starts every table over when a filter changes', () => {
		const history = new KindHistoryState('kind');
		const versions = [version('v1', 1), version('v3', 3), version('v2', 2)];
		expect(history.shown(versions).map((entry) => entry.id)).toEqual(['v3', 'v2', 'v1']);
		history.setFilters({ versionIds: ['v1', 'v3'] });
		expect(history.shown(versions).map((entry) => entry.id)).toEqual(['v3', 'v1']);
		history.index = {
			kindId: 'kind',
			resolvedScopeIds: null,
			status: 'ready',
			rows: rows('v3', PAGE_SIZE * 2)
		};
		history.setPage('v3', 'dated', 1);
		history.toggleUndated('v3');
		history.setColumns('v3', ['weight']);
		history.setFilters({ from: '2025-12-31', to: '' });
		expect(history.pagesOf('v3')).toEqual({ dated: 0, undated: 0, undatedOpen: true });
		expect(history.columns.v3).toEqual(['weight']);
		history.reset();
		expect(history.activeFilters).toBe(0);
		expect(history.shown(versions)).toHaveLength(3);
	});
});
