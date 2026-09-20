import { describe, expect, it, vi } from 'vitest';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { WORKBENCH_OPEN_AT_KEY } from './constants';
import { consumeOpenAt, type OpenAtStorage } from './open-at';
import { WorkbenchState } from './Workbench.svelte';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const START: ExplorerTrace = {
	id: 'demo-w-start',
	content: 'Начните отсюда',
	relation: 'actual',
	timezone: 'Europe/London',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'month',
		certainty: 'approximate',
		start: '1881-01',
		end: null
	},
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin
};
const snapshot: ExplorerSnapshot = {
	traces: [START],
	scopes: [],
	periods: [],
	intersections: [],
	scopeSegments: []
};
/** A window of today, as the app starts: the ribbon must travel to 1881 on its own. */
const window = {
	start: Date.parse('2026-03-01T00:00:00Z'),
	end: Date.parse('2026-10-30T00:00:00Z')
};

const storage = (values: Record<string, string> = {}) => {
	const map = new Map(Object.entries(values));
	const target: OpenAtStorage = {
		getItem: vi.fn((key: string) => map.get(key) ?? null),
		removeItem: vi.fn((key: string) => void map.delete(key))
	};
	return { target, dump: () => Object.fromEntries(map) };
};

const loaded = async (): Promise<WorkbenchState> => {
	const workbench = new WorkbenchState(new ViewportState(window));
	await workbench.load(async () => snapshot);
	return workbench;
};

describe('the one-shot opening request', () => {
	it('selects the record once, reveals its time on the ribbon and removes the key', async () => {
		const workbench = await loaded();
		const select = vi.spyOn(workbench, 'selectTrace');
		const reveal = vi.spyOn(workbench, 'revealSelected');
		const { target, dump } = storage({ [WORKBENCH_OPEN_AT_KEY]: 'demo-w-start' });

		consumeOpenAt(workbench, target);

		expect(select).toHaveBeenCalledWith('demo-w-start', 'context');
		expect(reveal).toHaveBeenCalledTimes(1);
		expect(workbench.selection.traceId).toBe('demo-w-start');
		expect(workbench.selection.source).toBe('context');
		// The window now frames January 1881, not today.
		expect(workbench.viewport.target.start).toBeLessThanOrEqual(Date.UTC(1881, 0, 1));
		expect(workbench.viewport.target.end).toBeGreaterThanOrEqual(Date.UTC(1881, 1, 1));
		expect(workbench.viewport.target.end).toBeLessThan(Date.UTC(1881, 3, 1));
		expect(dump()).toEqual({});

		// A second load finds nothing to consume.
		const revision = workbench.selection.revision;
		consumeOpenAt(workbench, target);
		expect(select).toHaveBeenCalledTimes(1);
		expect(workbench.selection.revision).toBe(revision);
	});

	it('ignores an unknown id silently, and still removes the key', async () => {
		const workbench = await loaded();
		const select = vi.spyOn(workbench, 'selectTrace');
		const { target, dump } = storage({ [WORKBENCH_OPEN_AT_KEY]: 'nobody' });

		consumeOpenAt(workbench, target);

		expect(select).not.toHaveBeenCalled();
		expect(workbench.selection.current).toBeNull();
		expect(workbench.viewport.target).toEqual(window);
		expect(dump()).toEqual({});
	});

	it('does nothing without a key, without storage, or with storage that refuses', async () => {
		const workbench = await loaded();
		const select = vi.spyOn(workbench, 'selectTrace');
		consumeOpenAt(workbench, storage().target);
		consumeOpenAt(workbench, null);
		consumeOpenAt(workbench, {
			getItem: () => {
				throw new Error('denied');
			},
			removeItem: () => {}
		});
		expect(select).not.toHaveBeenCalled();
		expect(workbench.selection.current).toBeNull();
	});
});
