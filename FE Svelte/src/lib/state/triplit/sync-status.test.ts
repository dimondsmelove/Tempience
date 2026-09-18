import { get } from 'svelte/store';
import { describe, expect, it, vi } from 'vitest';
import {
	createSyncStatusStore,
	getPendingChangeCount,
	getSyncDiagnostics,
	mapConnectionStatus
} from './sync-status';
import { SYNC_COLLECTIONS } from './sync-status-counts';
import type { TempienceTriplitClient } from './client';

describe('Triplit sync status', () => {
	it('maps transport state to user-facing connection state', () => {
		expect(mapConnectionStatus('OPEN', true, true)).toBe('online');
		expect(mapConnectionStatus('OPEN', true, false)).toBe('offline');
		expect(mapConnectionStatus('CLOSED', true, true)).toBe('offline');
		expect(mapConnectionStatus('CONNECTING', true, true)).toBe('connecting');
		expect(mapConnectionStatus('OPEN', false, true)).toBe('unpaired');
	});

	it('counts pending outbox entities across all collections', async () => {
		const pendingChanges = {
			traceKinds: {
				sets: new Map([['kind-1', {}]]),
				deletes: new Set()
			},
			traceKindVersions: {
				sets: new Map([['kindV-1', {}]]),
				deletes: new Set()
			},
			traces: {
				sets: new Map([
					['trace-1', {}],
					['trace-2', {}]
				]),
				deletes: new Set()
			},
			periods: { sets: new Map([['period-1', {}]]), deletes: new Set() },
			scopes: { sets: new Map([['scope-1', {}]]), deletes: new Set() },
			intersections: { sets: new Map(), deletes: new Set() },
			logs: {
				sets: new Map([
					['log-1', {}],
					['log-2', {}],
					['log-3', {}]
				]),
				deletes: new Set()
			}
		};
		const client = {
			awaitReady: Promise.resolve(),
			db: {
				kv: {},
				entityStore: { doubleBuffer: { getChanges: async () => pendingChanges } }
			}
		} as unknown as TempienceTriplitClient;

		expect(await getPendingChangeCount(client)).toBe(9);
	});

	it('compares local cache and server counts', async () => {
		const counts = {
			'local-only': {
				traceKinds: 1,
				traceKindVersions: 2,
				traces: 2,
				periods: 1,
				scopes: 1,
				intersections: 0,
				intentionAssessments: 1,
				logs: 3
			},
			'remote-only': {
				traceKinds: 1,
				traceKindVersions: 2,
				traces: 3,
				periods: 2,
				scopes: 1,
				intersections: 2,
				intentionAssessments: 0,
				logs: 4
			}
		};
		const client = {
			awaitReady: Promise.resolve(),
			db: {
				kv: {},
				entityStore: { doubleBuffer: { getChanges: async () => ({}) } }
			},
			query: (collection: string) => collection,
			fetch: async (query: string, options: { policy: keyof typeof counts }) =>
				Array.from({
					length: counts[options.policy][query as keyof (typeof counts)['local-only']] ?? 0
				})
		} as unknown as TempienceTriplitClient;

		expect(await getSyncDiagnostics(client)).toMatchObject({
			pending: 0,
			serverError: null,
			collections: {
				traceKinds: { local: 1, server: 1 },
				traceKindVersions: { local: 2, server: 2 },
				traces: { local: 2, server: 3 },
				periods: { local: 1, server: 2 },
				scopes: { local: 1, server: 1 },
				intersections: { local: 0, server: 2 },
				intentionAssessments: { local: 1, server: 0 },
				logs: { local: 3, server: 4 }
			}
		});
	});

	it('reports remote diagnostics errors without losing local counts', async () => {
		const client = {
			awaitReady: Promise.resolve(),
			db: {
				kv: {},
				entityStore: { doubleBuffer: { getChanges: async () => ({}) } }
			},
			query: (collection: string) => collection,
			fetch: async (query: string, options: { policy: string }) => {
				if (options.policy === 'remote-only') throw new Error('server unavailable');
				return Array.from({ length: query === 'traces' ? 2 : 0 });
			}
		} as unknown as TempienceTriplitClient;

		expect(await getSyncDiagnostics(client)).toMatchObject({
			serverError: 'server unavailable',
			collections: {
				traceKinds: { local: 0, server: null },
				traceKindVersions: { local: 0, server: null },
				traces: { local: 2, server: null },
				periods: { local: 0, server: null },
				scopes: { local: 0, server: null }
			}
		});
	});

	it('keeps a local-only DataSpace out of every sync path', async () => {
		const fetch = vi.fn(async (_query: string, options: { policy: string }) => {
			expect(options.policy).toBe('local-only');
			return [];
		});
		const client = {
			query: (collection: string) => collection,
			fetch
		} as unknown as TempienceTriplitClient;

		expect(get(createSyncStatusStore(client, { syncEnabled: false }))).toEqual({
			connection: 'local-only',
			pending: 0,
			lastSyncedAt: null,
			error: null
		});
		const diagnostics = await getSyncDiagnostics(client, { syncEnabled: false });
		expect(diagnostics.pending).toBe(0);
		expect(diagnostics.serverError).toBeNull();
		expect(diagnostics.collections.traces).toEqual({ local: 0, server: null });
		expect(fetch).toHaveBeenCalledTimes(SYNC_COLLECTIONS.length);
	});
});
