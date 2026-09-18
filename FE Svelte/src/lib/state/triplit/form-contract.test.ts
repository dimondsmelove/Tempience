import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import { asRepositoryClient, createTraceRepository, createTriplitRepository } from './repository';
import { schema } from './schema';
import { assertTraceData, assertTraceFormDefinition } from './trace-kind-v-validation';
import type { TraceKindVDraft } from './types';

const definition: TraceKindVDraft = {
	dataSchema: {
		type: 'object',
		additionalProperties: false,
		required: ['weight', 'date'],
		properties: {
			weight: { type: 'number', title: 'Вес' },
			date: { type: 'string', format: 'date' }
		}
	},
	uiSchema: { 'ui:options': { hideTitle: true } },
	fieldMeta: { '/properties/weight': { unit: { id: 'kg', label: 'кг' } } }
};

describe('typed form persistence contract', () => {
	it('validates actual calendar dates and finite numeric values with the repository validator', () => {
		expect(() => assertTraceFormDefinition(definition)).not.toThrow();
		expect(() =>
			assertTraceData({ weight: 78.4, date: '2026-09-08' }, definition.dataSchema)
		).not.toThrow();
		expect(() =>
			assertTraceData({ weight: 78.4, date: '2026-02-30' }, definition.dataSchema)
		).toThrow();
		expect(() =>
			assertTraceData({ weight: '78.4', date: '2026-09-08' }, definition.dataSchema)
		).toThrow();
		expect(() =>
			assertTraceFormDefinition({
				...definition,
				fieldMeta: { '/properties/date': { unit: { id: 'kg', label: 'кг' } } }
			})
		).toThrow();
	});
	it('captures a typed Trace with zero, one or many Scopes regardless of legacy capture settings', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repo = createTriplitRepository(client);
		try {
			const { kind, kindV } = await repo.createTraceKind({
				name: 'Замер',
				initialKindV: definition
			});
			const health = await repo.createScope({ name: 'Здоровье' });
			const personal = await repo.createScope({ name: 'Личное' });
			await repo.setScopeCaptureSettings(health.id, [kind.id]);
			const draft = {
				content: 'Замер',
				capturedAt: '2026-09-08T12:00:00Z',
				timezone: 'UTC',
				aboutKind: 'instant' as const,
				aboutTime: { basis: 'unknown' as const },
				kindId: kind.id,
				kindVId: kindV.id,
				data: { weight: 74, date: '2026-09-08' }
			};
			const links = async (traceId: string) =>
				(await repo.listIntersections()).filter((link) => link.fromId === traceId);
			const none = await repo.createTraceWithScopes(draft, []);
			expect(await links(none.id)).toEqual([]);
			const unlisted = await repo.createTraceWithScopes(draft, [personal.id]);
			expect((await links(unlisted.id)).map((link) => link.toId)).toEqual([personal.id]);
			const trace = await repo.createTraceWithScopes(draft, [health.id, personal.id, health.id]);
			expect(await links(trace.id)).toHaveLength(2);
			// Legacy settings stay readable but never gate or extend the explicit memberships.
			expect(await repo.listScopeCaptureSettings()).toEqual([
				{ id: health.id, suggestedKindIds: [kind.id] }
			]);
			await repo.setScopeCaptureSettings(health.id, []);
			const cleared = await repo.createTraceWithScopes(draft, [health.id]);
			expect((await links(cleared.id)).map((link) => link.toId)).toEqual([health.id]);
			await repo.editTrace(trace.id, { data: { weight: 73, date: '2026-09-09' } });
			expect((await repo.listTraces()).find((row) => row.id === trace.id)?.data).toEqual({
				weight: 73,
				date: '2026-09-09'
			});
		} finally {
			await client.disconnect();
		}
	});

	it('round-trips version metadata and edits data without rewriting free content or historical versions', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repo = createTriplitRepository(client);
		try {
			const { kind, kindV } = await repo.createTraceKind({
				name: 'Замер',
				initialKindV: definition
			});
			const scope = await repo.createScope({ name: 'Вес' });
			await repo.setScopeCaptureSettings(scope.id, [kind.id, kind.id]);
			expect(await repo.listScopeCaptureSettings()).toEqual([
				{ id: scope.id, suggestedKindIds: [kind.id] }
			]);
			await expect(repo.setScopeCaptureSettings(scope.id, ['missing'])).rejects.toThrow();
			expect((await repo.listScopeCaptureSettings())[0].suggestedKindIds).toEqual([kind.id]);
			const trace = await repo.createTraceWithScope(
				{
					content: 'После прогулки',
					capturedAt: '2026-09-08T12:00:00Z',
					timezone: 'UTC',
					aboutKind: 'instant',
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'exact',
						start: '2026-09-08',
						end: null
					},
					kindId: kind.id,
					kindVId: kindV.id,
					data: { weight: 78.4, date: '2026-09-08' }
				},
				scope.id
			);
			const next = await repo.createTraceKindV(kind.id, {
				...definition,
				kindName: ' Масса тела ',
				parentKindVIds: [kindV.id],
				uiSchema: { 'ui:options': { hideTitle: false } }
			});
			expect(await repo.listTraceKinds()).toEqual([
				expect.objectContaining({ id: kind.id, name: 'Масса тела', currentKindVId: next.id })
			]);
			const versionLog = (await repo.listLogs(next.id))[0];
			const kindLog = (await repo.listLogs(kind.id)).find(
				(log) => log.operationId === versionLog.operationId
			);
			expect(kindLog?.patch.name).toEqual({ before: 'Замер', after: 'Масса тела' });
			const edited = await repo.editTrace(trace.id, { data: { weight: 78.2, date: '2026-09-08' } });
			expect(edited.content).toBe('После прогулки');
			expect(edited.kindVId).toBe(kindV.id);
			expect(next.id).not.toBe(kindV.id);
			expect(
				(await repo.listTraceKindVersions(kind.id)).find((v) => v.id === kindV.id)
			).toMatchObject(definition);
			expect(
				(await repo.listIntersections()).some(
					(link) => link.fromId === trace.id && link.toId === scope.id && link.kind === 'belongs_to'
				)
			).toBe(true);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
	it.each(['invalid name', 'journal failure'])(
		'rolls back publication and rename on %s',
		async (failure) => {
			const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
			const repo = createTriplitRepository(client);
			try {
				const { kind } = await repo.createTraceKind({ name: 'Замер', initialKindV: definition });
				const before = {
					kinds: await repo.listTraceKinds(),
					versions: await repo.listTraceKindVersions(),
					logs: await repo.listLogs()
				};
				const adapter = asRepositoryClient(client);
				const failing = createTraceRepository({
					...adapter,
					transact: (callback) =>
						adapter.transact((transaction) =>
							callback({
								...transaction,
								insert: async (collection, row) => {
									if (collection === 'logs' && row.entityType === 'traceKind')
										throw new Error('Journal unavailable');
									return transaction.insert(collection, row);
								}
							})
						)
				});
				await expect(
					failing.createTraceKindV(kind.id, {
						...definition,
						kindName: failure === 'invalid name' ? ' ' : 'Масса тела'
					})
				).rejects.toThrow(failure === 'invalid name' ? 'name is required' : 'Journal unavailable');
				expect(await repo.listTraceKinds()).toEqual(before.kinds);
				expect(await repo.listTraceKindVersions()).toEqual(before.versions);
				expect(await repo.listLogs()).toEqual(before.logs);
			} finally {
				await client.clear({ full: true });
				client.disconnect();
			}
		}
	);
	it('opens legacy versions with absent metadata without changing the stored row', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		try {
			await client.insert('traceKindVersions', {
				id: 'old',
				kindId: 'kind',
				generation: 1,
				parentKindVIds: [],
				dataSchema: definition.dataSchema,
				createdAt: '2026-09-01',
				createdByDeviceId: 'old-device'
			});
			const [version] = await createTriplitRepository(client).listTraceKindVersions('kind');
			expect(version.uiSchema).toEqual({});
			expect(version.fieldMeta).toEqual({});
			expect((await client.fetchById('traceKindVersions', 'old'))?.uiSchema).toBeUndefined();
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
});
