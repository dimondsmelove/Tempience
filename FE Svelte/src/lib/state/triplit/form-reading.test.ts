import { TriplitClient } from '@triplit/client';
import { describe, expect, it, vi } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';

describe('form reads from the local replica', () => {
	it('publishes initial results and later changes without waiting for remote fetches', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repository = createTriplitRepository(client);
		const kinds = vi.fn(),
			versions = vi.fn(),
			scopes = vi.fn(),
			settings = vi.fn(),
			fail = vi.fn();
		const fetch = vi.spyOn(client, 'fetch');
		const subscriptions = [
			repository.subscribeTraceKinds(kinds, fail),
			repository.subscribeTraceKindVersions(versions, fail),
			repository.subscribeScopes(scopes, fail),
			repository.subscribeScopeCaptureSettings(settings, fail)
		];
		try {
			await vi.waitFor(
				() => {
					for (const next of [kinds, versions, scopes, settings])
						expect(next).toHaveBeenLastCalledWith([]);
				},
				{ timeout: 500 }
			);
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Вес',
				initialKindV: { dataSchema: { type: 'object', properties: { weight: { type: 'number' } } } }
			});
			const scope = await repository.createScope({ name: 'Измерения' });
			await repository.setScopeCaptureSettings(scope.id, [kind.id]);
			await vi.waitFor(
				() => {
					expect(kinds).toHaveBeenLastCalledWith([kind]);
					expect(versions).toHaveBeenLastCalledWith([kindV]);
					expect(scopes).toHaveBeenLastCalledWith([scope]);
					expect(settings).toHaveBeenLastCalledWith([
						{ id: scope.id, suggestedKindIds: [kind.id] }
					]);
				},
				{ timeout: 500 }
			);
			await client.update('traceKinds', kind.id, { name: 'Масса' });
			await repository.setScopeDeleted(scope.id, true);
			await vi.waitFor(
				() => {
					expect(kinds.mock.lastCall?.[0][0].name).toBe('Масса');
					expect(scopes).toHaveBeenLastCalledWith([]);
				},
				{ timeout: 500 }
			);
			expect(fetch).not.toHaveBeenCalled();
			expect(fail).not.toHaveBeenCalled();
		} finally {
			subscriptions.forEach((unsubscribe) => unsubscribe());
			fetch.mockRestore();
			await client.disconnect();
		}
	});

	it('reads only the selected trace and handles missing or deleted records', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repository = createTriplitRepository(client);
		try {
			const trace = await repository.createTrace({
				content: 'Запись',
				capturedAt: '2026-09-08T08:00:00.000Z',
				timezone: 'UTC',
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: '2026-09-08',
					end: null
				}
			});
			const fetch = vi.spyOn(client, 'fetch');
			expect(await repository.getTrace(trace.id)).toEqual(trace);
			expect(fetch).toHaveBeenCalledTimes(1);
			const [query, options] = fetch.mock.calls[0];
			expect(query.collectionName).toBe('traces');
			expect(options?.policy).toBe('local-only');
			expect(await repository.getTrace('missing')).toBeNull();
			await repository.setTraceDeleted(trace.id, true);
			expect(await repository.getTrace(trace.id)).toBeNull();
			fetch.mockRestore();
		} finally {
			await client.disconnect();
		}
	});
});
