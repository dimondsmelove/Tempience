import { expect, it, vi } from 'vitest';
import { loadWorkbenchSnapshot } from './load';

/**
 * The local store as another device left it on the server: «Оба видят» was deleted there.
 * The pull is what brings that row's `isDeleted: true` into the store; the reads filter after.
 */
const store = vi.hoisted(() => {
	const stamp = '2026-09-20T08:00:00.000Z';
	return {
		order: [] as string[],
		rows: {
			scopes: [
				{
					id: 'scope:shared',
					name: 'Оба видят',
					isDeleted: false,
					createdAt: stamp,
					updatedAt: stamp
				},
				{ id: 'scope:kept', name: 'Остаётся', isDeleted: false, createdAt: stamp, updatedAt: stamp }
			]
		} as Record<string, Record<string, unknown>[]>
	};
});
vi.mock('$lib/scenarios', () => ({ ensureActiveScenarioSeed: async () => {} }));
vi.mock('$lib/state/triplit/client', () => ({
	activeDataSpace: { id: 'canonical', syncEnabled: true },
	triplit: { ready: Promise.resolve() }
}));
vi.mock('$lib/model/LoadTiming/LoadTiming', () => ({
	loadTiming: { span: (_label: string, fn: () => unknown) => fn(), report: () => ({}) }
}));
vi.mock('$lib/state/triplit/inbound-sync-instance', () => ({
	inboundFeed: {
		pull: async () => {
			store.order.push('pull');
			// The server's answer lands in the local store: the row is deleted there.
			store.rows.scopes[0].isDeleted = true;
			return 'server';
		}
	}
}));
vi.mock('$lib/state/triplit', async () => {
	const { createTraceRepository } = await vi.importActual<
		typeof import('$lib/state/triplit/repository')
	>('$lib/state/triplit/repository');
	return {
		tempienceRepository: createTraceRepository({
			fetch: async (collection: string) => {
				store.order.push(collection);
				return (store.rows[collection] ?? []) as never;
			},
			transact: async () => {
				throw new Error('no writes in this test');
			}
		})
	};
});

it('waits for the server before the ribbon reads, so a Scope deleted elsewhere is gone from the snapshot', async () => {
	const snapshot = await loadWorkbenchSnapshot();
	expect(store.order[0]).toBe('pull');
	expect(store.order.filter((step) => step === 'pull')).toHaveLength(1);
	expect(store.order).toContain('scopes');
	expect(snapshot.scopes.map((scope) => scope.name)).toEqual(['Остаётся']);
});
