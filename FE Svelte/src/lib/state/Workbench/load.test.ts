import { afterEach, expect, it, vi } from 'vitest';
import * as display from '$lib/model/TraceForm/display';
import { loadWorkbenchSnapshot } from './load';

const fixture = vi.hoisted(() => ({
	version: {
		id: 'v1',
		generation: 1,
		dataSchema: {
			type: 'object',
			title: 'Reading',
			properties: { when: { type: 'string', format: 'date-time' } }
		}
	},
	traces: [
		{ id: 'ordinary', content: 'Original text', kindId: null, kindVId: null, data: null },
		{
			id: 'typed',
			content: 'Original typed text',
			kindId: 'k1',
			kindVId: 'v1',
			data: { when: '2026-09-09t10:00:00z' }
		},
		{
			id: 'imported',
			content: 'Imported text',
			kindId: 'k1',
			kindVId: 'v1',
			data: { when: 'invalid' }
		}
	]
}));
vi.mock('$lib/scenarios', () => ({ ensureActiveScenarioSeed: async () => {} }));
vi.mock('$lib/state/triplit', () => ({
	tempienceRepository: {
		listTraceKindVersions: async () => [fixture.version],
		listTraceKinds: async () => [{ id: 'k1', name: 'Reading kind' }]
	}
}));
vi.mock('$lib/state/triplit/client', () => ({
	activeDataSpace: { id: 'test' },
	triplit: { ready: Promise.resolve() }
}));
vi.mock('$lib/model/LoadTiming/LoadTiming', () => ({
	loadTiming: { span: (_label: string, fn: () => unknown) => fn(), report: () => ({}) }
}));
vi.mock('$lib/state/Workbench/snapshot', () => ({
	buildRepositoryExplorerSnapshot: async () => ({
		traces: fixture.traces,
		scopes: [],
		periods: [],
		intersections: [],
		scopeSegments: []
	})
}));
afterEach(() => vi.restoreAllMocks());

it('loads the whole feed with valid schema dates and invalid imported field values', async () => {
	const snapshot = await loadWorkbenchSnapshot();
	expect(snapshot.traces).toHaveLength(3);
	expect(snapshot.traces[0]).toEqual(fixture.traces[0]);
	expect(snapshot.traces[1].displayTitle).toContain('Reading');
	expect(snapshot.traces[2].displayFields).toEqual([{ label: 'when', value: 'invalid' }]);
});

it('retains original content and continues enriching later records if one display fails', async () => {
	vi.spyOn(display, 'traceFormDisplay').mockImplementationOnce(() => {
		throw new Error('Broken definition');
	});
	const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
	const snapshot = await loadWorkbenchSnapshot();
	expect(snapshot.traces).toHaveLength(3);
	expect(snapshot.traces[1]).toEqual(fixture.traces[1]);
	expect(snapshot.traces[2].displayTitle).toContain('Reading');
	expect(warning).toHaveBeenCalledWith('Cannot format typed trace', 'typed', 'v1');
});
