import { TriplitClient } from '@triplit/client';
import { describe, expect, it, vi } from 'vitest';
import { buildFieldPatches, logActionForDeleted } from './operations';
import {
	createTraceRepository,
	createTriplitRepository,
	type RepositoryClient
} from './repository';
import { schema } from './schema';
import type { JsonObject } from './types';

type StoredEntity = Record<string, unknown> & { id: string };
type Collection =
	| 'scopeCaptureSettings'
	| 'traceKinds'
	| 'traceKindVersions'
	| 'traces'
	| 'periods'
	| 'scopes'
	| 'scopeSegments'
	| 'intersections'
	| 'intentionAssessments'
	| 'sources'
	| 'assertions'
	| 'citations'
	| 'assertionRelations'
	| 'provenanceLinks'
	| 'logs';

const createFakeClient = (): RepositoryClient => {
	const collections: Record<Collection, Map<string, StoredEntity>> = {
		scopeCaptureSettings: new Map(),
		traceKinds: new Map(),
		traceKindVersions: new Map(),
		traces: new Map(),
		periods: new Map(),
		scopes: new Map(),
		intersections: new Map(),
		intentionAssessments: new Map(),
		scopeSegments: new Map(),
		sources: new Map(),
		assertions: new Map(),
		citations: new Map(),
		assertionRelations: new Map(),
		provenanceLinks: new Map(),
		logs: new Map()
	};

	return {
		transact: async (callback) => {
			const snapshot = Object.fromEntries(
				Object.entries(collections).map(([name, values]) => [
					name,
					new Map([...values].map(([id, value]) => [id, { ...value }]))
				])
			) as Record<Collection, Map<string, StoredEntity>>;
			try {
				return await callback({
					fetch: async (collection) => [...collections[collection].values()],
					fetchById: async (collection, id) => collections[collection].get(id),
					insert: async (collection, value) => {
						const entity = value as StoredEntity;
						collections[collection].set(entity.id, entity);
						return entity;
					},
					update: async (collection, id, value) => {
						const entity = collections[collection].get(id);
						if (!entity) throw new Error(`Missing ${collection}:${id}`);
						collections[collection].set(id, { ...entity, ...value });
					}
				});
			} catch (error) {
				for (const [name, values] of Object.entries(snapshot))
					collections[name as Collection] = values;
				throw error;
			}
		},
		fetch: async (collection) => [...collections[collection].values()]
	};
};

const traceDraft = {
	content: 'A local trace',
	capturedAt: '2026-08-04T08:00:00.000Z',
	timezone: 'Europe/Belgrade',
	aboutKind: 'instant' as const,
	aboutTime: {
		basis: 'absolute' as const,
		precision: 'minute' as const,
		certainty: 'exact' as const,
		start: '2026-08-04T08:00:00.000Z',
		end: null
	}
};

const expenseSchema: JsonObject = {
	type: 'object',
	additionalProperties: false,
	required: ['amount', 'category'],
	properties: {
		amount: { type: 'number', exclusiveMinimum: 0 },
		category: { type: 'string', minLength: 1 }
	}
};

describe('Triplit repository boundary', () => {
	it('builds a field-level patch instead of duplicating an entity snapshot', () => {
		expect(
			buildFieldPatches(
				{ content: 'old', isDeleted: false },
				{ content: 'new', isDeleted: false },
				['content', 'isDeleted']
			)
		).toEqual({ content: { before: 'old', after: 'new' } });
	});

	it('writes a trace and its log in one repository transaction', async () => {
		const client = createFakeClient();
		const repository = createTraceRepository(client);
		const trace = await repository.createTrace({
			...traceDraft,
			content: 'A first local trace',
			data: { source: 'capture' }
		});

		const logs = await repository.listLogs(trace.id);
		const [stored] = await client.fetch('traces');
		expect(trace).toMatchObject({
			kindId: null,
			kindVId: null,
			data: { source: 'capture' },
			isDeleted: false
		});
		expect(stored).toHaveProperty('data', { source: 'capture' });
		expect(stored).toHaveProperty('aboutTime', traceDraft.aboutTime);
		expect(stored).toHaveProperty('aboutAt', traceDraft.aboutTime.start);
		expect(stored).not.toHaveProperty('dataJson');
		expect(logs).toHaveLength(1);
		expect(logs[0]?.action).toBe('created');
	});

	it('normalizes legacy exact placement in memory without rewriting the row', async () => {
		const client = createFakeClient();
		await client.transact(async (transaction) => {
			await transaction.insert('traces', {
				id: 'legacy-trace',
				capturedAt: '2026-08-04T08:00:00.000Z',
				timezone: 'Europe/Belgrade',
				aboutKind: 'instant',
				aboutAt: '2024-10-05T11:30:00.000Z',
				aboutStart: null,
				aboutEnd: null,
				aboutTraceId: null,
				content: 'Legacy exact Trace',
				relation: null,
				kindId: null,
				kindVId: null,
				data: null,
				isDeleted: false,
				createdAt: '2026-08-04T08:00:00.000Z',
				updatedAt: '2026-08-04T08:00:00.000Z'
			});
		});

		const [trace] = await createTraceRepository(client).listTraces();
		const [stored] = await client.fetch('traces');
		expect(trace?.aboutTime).toEqual({
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '2024-10-05T11:30:00.000Z',
			end: null
		});
		expect(stored).not.toHaveProperty('aboutTime');
	});

	it('creates a TraceKind and its initial immutable TraceKindV atomically', async () => {
		const repository = createTraceRepository(createFakeClient());
		const { kind, kindV } = await repository.createTraceKind({
			name: ' Expense ',
			initialKindV: { dataSchema: expenseSchema }
		});
		const logs = await repository.listLogs();

		expect(kind).toMatchObject({ name: 'Expense', currentKindVId: kindV.id });
		expect(kindV).toMatchObject({
			kindId: kind.id,
			generation: 1,
			parentKindVIds: [],
			createdByDeviceId: expect.any(String)
		});
		expect(await repository.listTraceKinds()).toEqual([kind]);
		expect(await repository.listTraceKindVersions(kind.id)).toEqual([kindV]);
		expect(
			logs.filter((log) => log.entityId === kind.id || log.entityId === kindV.id)
		).toHaveLength(2);
		expect(new Set(logs.map((log) => log.operationId)).size).toBe(1);
	});

	it('installs a deterministically identified TraceKind exactly once', async () => {
		const repository = createTraceRepository(createFakeClient());
		const seed = {
			id: 'builtin:weight',
			name: 'Weight',
			initialKindV: {
				id: 'builtin:weight:v1',
				dataSchema: {
					type: 'object',
					additionalProperties: false,
					required: ['weightKg'],
					properties: { weightKg: { type: 'number', exclusiveMinimum: 0 } }
				} satisfies JsonObject
			}
		};

		const first = await repository.ensureTraceKind(seed);
		const second = await repository.ensureTraceKind(seed);

		expect(second).toEqual(first);
		expect(first).toMatchObject({
			kind: { id: seed.id, currentKindVId: seed.initialKindV.id },
			kindV: { id: seed.initialKindV.id, kindId: seed.id, generation: 1 }
		});
		expect(await repository.listTraceKinds()).toHaveLength(1);
		expect(await repository.listTraceKindVersions()).toHaveLength(1);
		expect(await repository.listLogs()).toHaveLength(2);
	});

	it('rejects a conflicting seeded contract instead of mutating stored data', async () => {
		const repository = createTraceRepository(createFakeClient());
		const seed = {
			id: 'builtin:weight',
			name: 'Weight',
			initialKindV: {
				id: 'builtin:weight:v1',
				dataSchema: {
					type: 'object',
					additionalProperties: false,
					required: ['weightKg'],
					properties: { weightKg: { type: 'number', exclusiveMinimum: 0 } }
				} satisfies JsonObject
			}
		};
		await repository.ensureTraceKind(seed);

		await expect(
			repository.ensureTraceKind({
				...seed,
				initialKindV: {
					...seed.initialKindV,
					dataSchema: {
						...seed.initialKindV.dataSchema,
						title: 'Conflicting Weight'
					}
				}
			})
		).rejects.toThrow('conflicts with stored data');
		expect(await repository.listTraceKinds()).toHaveLength(1);
		expect(await repository.listTraceKindVersions()).toHaveLength(1);
		expect(await repository.listLogs()).toHaveLength(2);
	});

	it('validates typed Trace data against its pinned TraceKindV', async () => {
		const repository = createTraceRepository(createFakeClient());
		const { kind, kindV } = await repository.createTraceKind({
			name: 'Expense',
			initialKindV: { dataSchema: expenseSchema }
		});
		const trace = await repository.createTrace({
			...traceDraft,
			kindId: kind.id,
			kindVId: kindV.id,
			data: { amount: 12.5, category: 'food' }
		});
		const traceCount = (await repository.listTraces(true)).length;
		const logCount = (await repository.listLogs()).length;

		expect(trace).toMatchObject({
			kindId: kind.id,
			kindVId: kindV.id,
			data: { amount: 12.5, category: 'food' }
		});
		await expect(
			repository.createTrace({
				...traceDraft,
				kindId: kind.id,
				kindVId: kindV.id,
				data: { amount: 'invalid', category: 'food' }
			})
		).rejects.toThrow('Trace data does not match TraceKindV');
		await expect(
			repository.editTrace(trace.id, {
				data: { amount: -1, category: 'food' }
			})
		).rejects.toThrow('Trace data does not match TraceKindV');
		expect(await repository.listTraces(true)).toHaveLength(traceCount);
		expect(await repository.listLogs()).toHaveLength(logCount);
		expect((await repository.listTraces(true))[0]?.data).toEqual({
			amount: 12.5,
			category: 'food'
		});
	});

	it('rejects incomplete or mismatched TraceKind and TraceKindV references', async () => {
		const repository = createTraceRepository(createFakeClient());
		const first = await repository.createTraceKind({
			name: 'First',
			initialKindV: { dataSchema: expenseSchema }
		});
		const second = await repository.createTraceKind({
			name: 'Second',
			initialKindV: { dataSchema: expenseSchema }
		});

		await expect(
			repository.createTrace({
				...traceDraft,
				kindId: first.kind.id,
				data: { amount: 1, category: 'food' }
			})
		).rejects.toThrow('must both be set');
		await expect(
			repository.createTrace({
				...traceDraft,
				kindId: first.kind.id,
				kindVId: second.kindV.id,
				data: { amount: 1, category: 'food' }
			})
		).rejects.toThrow('does not belong');
	});

	it('keeps existing Trace records pinned when a new TraceKindV becomes current', async () => {
		const repository = createTraceRepository(createFakeClient());
		const initial = await repository.createTraceKind({
			name: 'Expense',
			initialKindV: { dataSchema: expenseSchema }
		});
		const existingTrace = await repository.createTrace({
			...traceDraft,
			kindId: initial.kind.id,
			kindVId: initial.kindV.id,
			data: { amount: 10, category: 'food' }
		});
		const nextKindV = await repository.createTraceKindV(initial.kind.id, {
			dataSchema: {
				...expenseSchema,
				required: ['amount', 'category', 'merchant'],
				properties: {
					...(expenseSchema.properties as JsonObject),
					merchant: { type: 'string', minLength: 1 }
				}
			}
		});

		const [kind] = await repository.listTraceKinds();
		const kindVersions = await repository.listTraceKindVersions(initial.kind.id);
		const edited = await repository.editTrace(existingTrace.id, {
			data: { amount: 11, category: 'food' }
		});

		expect(kind?.currentKindVId).toBe(nextKindV.id);
		expect(kindVersions.map((kindV) => kindV.generation)).toEqual([1, 2]);
		expect(nextKindV.parentKindVIds).toEqual([initial.kindV.id]);
		expect(kindVersions[0]).toEqual(initial.kindV);
		expect(edited.kindVId).toBe(initial.kindV.id);
	});

	it('preserves concurrent TraceKindV branches and resolves them with a multi-parent kindV', async () => {
		const repository = createTraceRepository(createFakeClient());
		const initial = await repository.createTraceKind({
			name: 'Expense',
			initialKindV: { dataSchema: expenseSchema }
		});
		const merchantSchema: JsonObject = {
			...expenseSchema,
			required: ['amount', 'category', 'merchant'],
			properties: {
				...(expenseSchema.properties as JsonObject),
				merchant: { type: 'string', minLength: 1 }
			}
		};
		const currencySchema: JsonObject = {
			...expenseSchema,
			required: ['amount', 'category', 'currency'],
			properties: {
				...(expenseSchema.properties as JsonObject),
				currency: { type: 'string', minLength: 3, maxLength: 3 }
			}
		};
		const merchantBranch = await repository.createTraceKindV(initial.kind.id, {
			dataSchema: merchantSchema,
			parentKindVIds: [initial.kindV.id]
		});
		const merchantTrace = await repository.createTrace({
			...traceDraft,
			kindId: initial.kind.id,
			kindVId: merchantBranch.id,
			data: { amount: 10, category: 'food', merchant: 'Market' }
		});
		const currencyBranch = await repository.createTraceKindV(initial.kind.id, {
			dataSchema: currencySchema,
			parentKindVIds: [initial.kindV.id]
		});
		const currencyTrace = await repository.createTrace({
			...traceDraft,
			kindId: initial.kind.id,
			kindVId: currencyBranch.id,
			data: { amount: 12, category: 'transport', currency: 'EUR' }
		});

		const divergentHeads = await repository.listTraceKindVersionHeads(initial.kind.id);
		expect(divergentHeads.map((kindV) => kindV.id).toSorted()).toEqual(
			[merchantBranch.id, currencyBranch.id].toSorted()
		);
		expect(divergentHeads.map((kindV) => kindV.generation)).toEqual([2, 2]);
		expect((await repository.listTraceKinds())[0]?.currentKindVId).toBe(currencyBranch.id);

		const resolution = await repository.createTraceKindV(initial.kind.id, {
			dataSchema: currencySchema,
			parentKindVIds: [currencyBranch.id, merchantBranch.id]
		});
		expect(resolution).toMatchObject({
			generation: 3,
			parentKindVIds: [currencyBranch.id, merchantBranch.id].toSorted()
		});
		expect(await repository.listTraceKindVersionHeads(initial.kind.id)).toEqual([resolution]);
		expect((await repository.listTraces(true)).map((trace) => trace.kindVId).toSorted()).toEqual(
			[merchantTrace.kindVId, currencyTrace.kindVId].toSorted()
		);
	});

	it('rejects invalid TraceKindV parent sets without writing a partial kindV', async () => {
		const repository = createTraceRepository(createFakeClient());
		const first = await repository.createTraceKind({
			name: 'First',
			initialKindV: { dataSchema: expenseSchema }
		});
		const second = await repository.createTraceKind({
			name: 'Second',
			initialKindV: { dataSchema: expenseSchema }
		});
		const before = await repository.listTraceKindVersions();

		await expect(
			repository.createTraceKindV(first.kind.id, {
				dataSchema: expenseSchema,
				parentKindVIds: []
			})
		).rejects.toThrow('at least one parent');
		await expect(
			repository.createTraceKindV(first.kind.id, {
				dataSchema: expenseSchema,
				parentKindVIds: [first.kindV.id, first.kindV.id]
			})
		).rejects.toThrow('must be unique');
		await expect(
			repository.createTraceKindV(first.kind.id, {
				dataSchema: expenseSchema,
				parentKindVIds: ['missing-kindV']
			})
		).rejects.toThrow('traceKindVersions entity not found');
		await expect(
			repository.createTraceKindV(first.kind.id, {
				dataSchema: expenseSchema,
				parentKindVIds: [second.kindV.id]
			})
		).rejects.toThrow('does not belong');

		expect(await repository.listTraceKindVersions()).toEqual(before);
	});

	it('rejects invalid TraceKindV schemas without writing Kind or Log records', async () => {
		const repository = createTraceRepository(createFakeClient());

		await expect(
			repository.createTraceKind({
				name: 'Invalid',
				initialKindV: { dataSchema: { type: 'string' } }
			})
		).rejects.toThrow('must declare an object root');
		expect(await repository.listTraceKinds()).toEqual([]);
		expect(await repository.listTraceKindVersions()).toEqual([]);
		expect(await repository.listLogs()).toEqual([]);
	});

	it('reads the local replica without advancing the remote timeout when disconnected', async () => {
		const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
		const repository = createTriplitRepository(client);
		try {
			await client.ready;
			const trace = await repository.createTrace(traceDraft);
			vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
			let records: Awaited<ReturnType<typeof repository.listTraces>> | undefined;
			const read = repository.listTraces().then((value) => {
				records = value;
			});
			await vi.advanceTimersByTimeAsync(0);
			expect(records).toEqual([trace]);
			await read;
		} finally {
			vi.useRealTimers();
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('round-trips typed Trace data through the actual Triplit schema', async () => {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		const repository = createTriplitRepository(client);

		try {
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Expense',
				initialKindV: { dataSchema: expenseSchema }
			});
			const trace = await repository.createTrace({
				...traceDraft,
				kindId: kind.id,
				kindVId: kindV.id,
				data: { amount: 20, category: 'transport' }
			});
			const stored = await client.fetch(client.query('traces'), { policy: 'local-only' });
			const storedKindVersions = await client.fetch(client.query('traceKindVersions'), {
				policy: 'local-only'
			});

			expect(trace.data).toEqual({ amount: 20, category: 'transport' });
			expect(storedKindVersions[0]).toMatchObject({
				generation: 1,
				parentKindVIds: [],
				createdByDeviceId: expect.any(String)
			});
			expect(stored[0]).toMatchObject({
				kindId: kind.id,
				kindVId: kindV.id,
				data: { amount: 20, category: 'transport' }
			});
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('round-trips a bounded Period through the actual Triplit schema', async () => {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		const repository = createTriplitRepository(client);

		try {
			const period = await repository.createPeriod({
				name: 'Ноябрь–декабрь 2025',
				time: { precision: 'month', start: '2025-11', end: '2025-12' },
				timezone: 'Europe/Belgrade',
				note: 'Первая строка рефлексии.\nВторая строка сохраняет форму.'
			});
			const stored = await client.fetch(client.query('periods'), { policy: 'local-only' });

			expect(stored).toEqual([expect.objectContaining(period)]);
			expect(await repository.listPeriods()).toEqual([period]);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('round-trips label-only Scope segments through the actual Triplit schema', async () => {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		const repository = createTriplitRepository(client);

		try {
			const scope = await repository.createScope({ name: '1Win' });
			await repository.createScopeSegment(scope.id, {
				startAt: '2023-01-01T00:00:00.000Z',
				label: 'Landings'
			});
			await repository.bumpScopeSegment(scope.id, {
				at: '2024-01-01T00:00:00.000Z',
				label: 'w.tv'
			});
			const stored = (
				await client.fetch(client.query('scopeSegments'), { policy: 'local-only' })
			).toSorted((left, right) => left.position - right.position);

			expect(stored).toEqual([
				expect.objectContaining({
					scopeId: scope.id,
					label: 'Landings',
					endAt: '2024-01-01T00:00:00.000Z'
				}),
				expect.objectContaining({
					scopeId: scope.id,
					label: 'w.tv',
					endAt: null
				})
			]);
			for (const segment of stored) expect(segment).not.toHaveProperty('phase');
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('round-trips Trace composition through the actual Triplit schema', async () => {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		const repository = createTriplitRepository(client);

		try {
			const whole = await repository.createTrace({ ...traceDraft, content: 'Whole' });
			const part = await repository.createTrace({ ...traceDraft, content: 'Part' });
			const relation = await repository.linkTraceToTrace(part.id, whole.id, 'part_of');
			const stored = await client.fetch(client.query('intersections'), {
				policy: 'local-only'
			});

			expect(stored).toEqual([
				expect.objectContaining({
					id: relation.id,
					fromId: part.id,
					toId: whole.id,
					kind: 'part_of'
				})
			]);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('creates a Trace and its Scope link in one transaction', async () => {
		const repository = createTraceRepository(createFakeClient());
		const scope = await repository.createScope({ name: 'Ledger scope' });
		const trace = await repository.createTraceWithScope(traceDraft, scope.id);
		const intersections = await repository.listIntersections();
		const logs = await repository.listLogs();

		expect(trace.content).toBe('A local trace');
		expect(intersections).toEqual([
			expect.objectContaining({ fromId: trace.id, toId: scope.id, kind: 'belongs_to' })
		]);
		expect(logs.filter((log) => log.operationId === logs[0]?.operationId)).toHaveLength(2);
	});

	it('captures zero or many Scope memberships with one operation and no duplicate links', async () => {
		const repository = createTraceRepository(createFakeClient());
		const first = await repository.createScope({ name: 'Первый' });
		const second = await repository.createScope({ name: 'Второй' });
		const unscoped = await repository.createTraceWithScopes(traceDraft, []);
		const trace = await repository.createTraceWithScopes(traceDraft, [
			first.id,
			second.id,
			first.id
		]);
		const links = await repository.listIntersections();
		expect(links.filter((link) => link.fromId === unscoped.id)).toEqual([]);
		expect(
			links
				.filter((link) => link.fromId === trace.id)
				.map((link) => link.toId)
				.sort()
		).toEqual([first.id, second.id].sort());
		const logs = (await repository.listLogs()).filter(
			(log) => log.entityId === trace.id || links.some((link) => link.id === log.entityId)
		);
		expect(logs).toHaveLength(3);
		expect(new Set(logs.map((log) => log.operationId)).size).toBe(1);
	});

	it('does not partially save a capture when any selected Scope is missing or deleted', async () => {
		const repository = createTraceRepository(createFakeClient());
		const scope = await repository.createScope({ name: 'Scope' });
		const before = await repository.listLogs();
		await expect(
			repository.createTraceWithScopes(traceDraft, [scope.id, 'missing'])
		).rejects.toThrow();
		expect(await repository.listTraces()).toEqual([]);
		expect(await repository.listIntersections()).toEqual([]);
		expect(await repository.listLogs()).toEqual(before);
		await repository.setScopeDeleted(scope.id, true);
		await expect(repository.createTraceWithScopes(traceDraft, [scope.id])).rejects.toThrow(
			'существующий Scope'
		);
		expect(await repository.listTraces()).toEqual([]);
	});

	it('creates typed weekly budgets and time entries with canonical relations', async () => {
		const repository = createTraceRepository(createFakeClient());
		const scope = await repository.createScope({ name: 'Ledger scope' });
		const budget = await repository.createWeeklyBudget({
			content: 'Weekly engineering budget',
			timezone: 'UTC',
			aboutStart: '2026-08-03T00:00:00.000Z',
			aboutEnd: '2026-08-10T00:00:00.000Z',
			targetMinutes: 300,
			scopeId: scope.id
		});
		const intent = await repository.createFixedTimeIntent({
			content: 'Fixed intent',
			timezone: 'UTC',
			aboutStart: '2026-08-04T09:00:00.000Z',
			aboutEnd: '2026-08-04T10:00:00.000Z',
			scopeId: scope.id
		});
		const actual = await repository.createActual({
			content: 'Actual work',
			timezone: 'UTC',
			aboutStart: '2026-08-04T10:00:00.000Z',
			aboutEnd: '2026-08-04T11:30:00.000Z',
			scopeId: scope.id
		});

		expect(budget).toMatchObject({ relation: 'intend', aboutKind: 'interval' });
		expect(budget.data).toEqual({ ledger: { kind: 'weekly_budget', targetMinutes: 300 } });
		expect(intent.relation).toBe('intend');
		expect(actual.relation).toBe('actual');
		expect(
			(await repository.listIntersections()).filter((item) => item.toId === scope.id)
		).toHaveLength(3);
	});

	it('rejects invalid Ledger intervals and budget targets at the repository boundary', async () => {
		const repository = createTraceRepository(createFakeClient());
		const scope = await repository.createScope({ name: 'Ledger scope' });

		await expect(
			repository.createWeeklyBudget({
				content: 'Invalid budget',
				timezone: 'UTC',
				aboutStart: '2026-08-10T00:00:00.000Z',
				aboutEnd: '2026-08-03T00:00:00.000Z',
				targetMinutes: 0,
				scopeId: scope.id
			})
		).rejects.toThrow('targetMinutes');
	});

	it('records edits as field-level Logs', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace(traceDraft);

		const edited = await repository.editTrace(trace.id, { content: 'Updated local trace' });
		const logs = await repository.listLogs(trace.id);

		expect(edited.content).toBe('Updated local trace');
		expect(logs[0]?.patch.content).toEqual({
			before: 'A local trace',
			after: 'Updated local trace'
		});
	});

	it('records delete and restore as separate logs', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace({ ...traceDraft, content: 'A restorable trace' });

		await repository.setTraceDeleted(trace.id, true);
		await repository.setTraceDeleted(trace.id, false);
		const logs = await repository.listLogs(trace.id);

		expect(logs.map((log) => log.action)).toEqual(['restored', 'deleted', 'created']);
		expect(logActionForDeleted(false)).toBe('restored');
	});

	it('creates, edits, deletes, restores, and orders Periods without persisted membership', async () => {
		const client = createFakeClient();
		const repository = createTraceRepository(client);
		const later = await repository.createPeriod({
			name: ' Ноябрь–декабрь 2025 ',
			time: { precision: 'month', start: '2025-11', end: '2025-12' },
			timezone: 'Europe/Belgrade'
		});
		const earlier = await repository.createPeriod({
			name: 'Сентябрь 2025',
			time: { precision: 'month', start: '2025-09', end: '2025-09' },
			timezone: 'Europe/Belgrade'
		});

		const edited = await repository.editPeriod(later.id, { name: 'Конец 2025' });
		await repository.editPeriod(later.id, {
			time: { precision: 'month', start: '2025-11', end: '2025-12' }
		});
		await repository.setPeriodDeleted(earlier.id, true);
		await repository.setPeriodDeleted(earlier.id, false);

		expect(edited.name).toBe('Конец 2025');
		expect((await repository.listPeriods()).map((period) => period.id)).toEqual([
			earlier.id,
			later.id
		]);
		expect(await client.fetch('intersections')).toEqual([]);
		expect((await repository.listLogs(later.id)).map((log) => log.action)).toEqual([
			'updated',
			'created'
		]);
		expect((await repository.listLogs(earlier.id)).map((log) => log.action)).toEqual([
			'restored',
			'deleted',
			'created'
		]);
		expect((await repository.listLogs()).every((log) => log.entityType === 'period')).toBe(true);
	});

	it('preserves Period notes and normalizes whitespace-only mutations', async () => {
		const repository = createTraceRepository(createFakeClient());
		const period = await repository.createPeriod({
			name: 'Reflexion',
			time: { precision: 'month', start: '2025-11', end: '2025-11' },
			timezone: 'Europe/Belgrade',
			note: 'first line\nsecond line'
		});
		expect(period.note).toBe('first line\nsecond line');
		const noOp = await repository.editPeriod(period.id, { note: 'first line\nsecond line' });
		expect(noOp.note).toBe(period.note);
		expect(await repository.listLogs(period.id)).toHaveLength(1);
		const spacedNote = '  first line\nsecond line  ';
		const preserved = await repository.editPeriod(period.id, { note: spacedNote });
		expect(preserved.note).toBe(spacedNote);
		const cleared = await repository.editPeriod(period.id, { note: ' \n\t ' });
		expect(cleared.note).toBeNull();
		expect(
			(await repository.listLogs(period.id)).find((log) => log.action === 'updated')?.patch
		).toEqual({
			note: { before: spacedNote, after: null }
		});
	});

	it('rejects invalid Period boundaries before writing Period or Log records', async () => {
		const client = createFakeClient();
		const repository = createTraceRepository(client);

		await expect(
			repository.createPeriod({
				name: 'Invalid',
				time: { precision: 'month', start: '2025-12', end: '2025-11' },
				timezone: 'Europe/Belgrade'
			})
		).rejects.toThrow('must not be before start');
		await expect(
			repository.createPeriod({
				name: 'Invalid timezone',
				time: { precision: 'month', start: '2025-12', end: '2025-12' },
				timezone: 'Belgrade'
			})
		).rejects.toThrow('valid IANA time zone');
		expect(await repository.listPeriods(true)).toEqual([]);
		expect(await repository.listLogs()).toEqual([]);
	});

	it('lists traces, scopes, and intersections through the repository boundary', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace(traceDraft);
		const scope = await repository.createScope({ name: 'Local-first W1' });
		await repository.linkTraceToScope(trace.id, scope.id);

		expect(await repository.listTraces()).toHaveLength(1);
		expect(await repository.listScopes()).toEqual([expect.objectContaining({ id: scope.id })]);
		expect(await repository.listIntersections()).toEqual([
			expect.objectContaining({ fromId: trace.id, toId: scope.id })
		]);

		await repository.setTraceDeleted(trace.id, true);
		expect(await repository.listTraces()).toHaveLength(0);
		expect(await repository.listTraces(true)).toHaveLength(1);
	});

	it('stores interval placement and intent relation on a Trace', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace({
			...traceDraft,
			content: 'A planned interval',
			relation: 'intend',
			aboutKind: 'interval',
			aboutTime: {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: '2026-08-07T08:00:00.000Z',
				end: '2026-08-07T09:00:00.000Z'
			}
		});

		expect(trace).toMatchObject({
			relation: 'intend',
			aboutKind: 'interval',
			aboutTime: {
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: '2026-08-07T08:00:00.000Z',
				end: '2026-08-07T09:00:00.000Z'
			},
			aboutStart: '2026-08-07T08:00:00.000Z',
			aboutEnd: '2026-08-07T09:00:00.000Z'
		});
	});

	it('persists coarse and approximate evidence without exact timestamp projections', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace({
			...traceDraft,
			aboutTime: {
				basis: 'absolute',
				precision: 'month',
				certainty: 'approximate',
				start: '2023-01',
				end: '2023-03'
			}
		});

		expect(trace).toMatchObject({
			aboutTime: {
				basis: 'absolute',
				precision: 'month',
				certainty: 'approximate',
				start: '2023-01',
				end: '2023-03'
			},
			aboutAt: null,
			aboutStart: null,
			aboutEnd: null
		});
	});

	it('validates relative anchors and recomputes exact projections on edit', async () => {
		const repository = createTraceRepository(createFakeClient());
		const anchor = await repository.createTrace({ ...traceDraft, content: 'Arrival' });
		const relative = await repository.createTrace({
			...traceDraft,
			content: 'After arrival',
			aboutTime: {
				basis: 'relative',
				precision: 'unknown',
				anchorTraceId: anchor.id,
				relation: 'after'
			}
		});

		expect(relative.aboutTime).toMatchObject({
			basis: 'relative',
			anchorTraceId: anchor.id,
			relation: 'after'
		});
		await expect(
			repository.createTrace({
				...traceDraft,
				aboutTime: {
					basis: 'relative',
					precision: 'unknown',
					anchorTraceId: 'missing-anchor',
					relation: 'after'
				}
			})
		).rejects.toThrow('traces entity not found: missing-anchor');

		const edited = await repository.editTrace(anchor.id, {
			aboutTime: {
				basis: 'absolute',
				precision: 'month',
				certainty: 'exact',
				start: '2026-08',
				end: null
			}
		});
		const [updatedLog] = await repository.listLogs(anchor.id);
		expect(edited).toMatchObject({ aboutAt: null, aboutStart: null, aboutEnd: null });
		expect(updatedLog?.patch.aboutTime).toEqual({
			before: traceDraft.aboutTime,
			after: edited.aboutTime
		});
		expect(updatedLog?.patch.aboutAt).toEqual({
			before: traceDraft.aboutTime.start,
			after: null
		});
	});

	it('stores a Trace reference placement', async () => {
		const repository = createTraceRepository(createFakeClient());
		const target = await repository.createTrace({ ...traceDraft, content: 'Target trace' });
		const trace = await repository.createTrace({
			...traceDraft,
			content: 'A revisit',
			relation: 'revisit',
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: target.id
		});

		expect(trace).toMatchObject({
			relation: 'revisit',
			aboutKind: 'trace_ref',
			aboutTraceId: target.id
		});
	});

	it('records Scope edits, delete, and restore in Logs', async () => {
		const repository = createTraceRepository(createFakeClient());
		const scope = await repository.createScope({
			name: 'Initial Scope',
			note: 'Initial context'
		});

		await repository.editScope(scope.id, {
			name: 'Renamed Scope',
			note: 'First line\nSecond line'
		});
		await repository.setScopeDeleted(scope.id, true);
		await repository.setScopeDeleted(scope.id, false);

		const restored = (await repository.listScopes(true))[0];
		const logs = await repository.listLogs(scope.id);
		expect(restored).toMatchObject({
			name: 'Renamed Scope',
			note: 'First line\nSecond line',
			isDeleted: false
		});
		expect(logs.map((log) => log.action)).toEqual(['restored', 'deleted', 'updated', 'created']);
		expect(logs.find((log) => log.action === 'updated')?.patch.note).toEqual({
			before: 'Initial context',
			after: 'First line\nSecond line'
		});
	});

	it('creates and bumps label-only Scope segments with one shared operation log', async () => {
		const client = createFakeClient();
		const repository = createTraceRepository(client);
		const scope = await repository.createScope({ name: 'Focus scope' });
		const initial = await repository.createScopeSegment(scope.id, {
			startAt: '2026-08-04T08:00:00.000Z',
			label: 'Landings'
		});
		const next = await repository.bumpScopeSegment(scope.id, {
			at: '2026-08-05T08:00:00.000Z',
			label: 'w.tv'
		});
		const segments = await repository.listScopeSegments(scope.id);
		const logs = await repository.listLogs();

		expect(initial).toMatchObject({
			scopeId: scope.id,
			label: 'Landings',
			endAt: null,
			position: 0
		});
		expect(next).toMatchObject({
			scopeId: scope.id,
			label: 'w.tv',
			startAt: '2026-08-05T08:00:00.000Z',
			position: 1
		});
		expect(segments).toHaveLength(2);
		expect(segments[0]).toMatchObject({ endAt: '2026-08-05T08:00:00.000Z' });
		for (const segment of await client.fetch('scopeSegments')) {
			expect(segment).not.toHaveProperty('phase');
		}
		expect(logs.filter((log) => log.entityType === 'scopeSegment')).toHaveLength(3);
	});

	it('creates a Trace-to-Scope Intersection and its Log', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace(traceDraft);
		const scope = await repository.createScope({ name: 'Moving 2026' });

		const intersection = await repository.linkTraceToScope(trace.id, scope.id);
		const logs = await repository.listLogs(intersection.id);

		expect(intersection).toMatchObject({
			fromId: trace.id,
			toId: scope.id,
			kind: 'belongs_to',
			context: null,
			isDeleted: false
		});
		expect(logs[0]?.action).toBe('linked');
	});

	it('stores relationship context and supports delete/restore', async () => {
		const repository = createTraceRepository(createFakeClient());
		const child = await repository.createScope({ name: 'Child' });
		const parent = await repository.createScope({ name: 'Parent' });

		const relation = await repository.linkScopeToScope(
			child.id,
			parent.id,
			'child_of',
			'Part of the broader initiative'
		);
		const edited = await repository.editIntersection(relation.id, {
			context: 'Updated explanation'
		});
		await repository.setIntersectionDeleted(relation.id, true);
		const { link: restored } = await repository.setIntersectionDeleted(relation.id, false);

		expect(edited.context).toBe('Updated explanation');
		expect(restored).toMatchObject({ context: 'Updated explanation', isDeleted: false });
		expect((await repository.listLogs(relation.id)).map((log) => log.action)).toEqual([
			'restored',
			'deleted',
			'updated',
			'linked'
		]);
	});

	it('enforces one active Scope parent and prevents hierarchy cycles', async () => {
		const repository = createTraceRepository(createFakeClient());
		const child = await repository.createScope({ name: 'Child' });
		const firstParent = await repository.createScope({ name: 'First parent' });
		const secondParent = await repository.createScope({ name: 'Second parent' });

		await repository.setScopeParent(child.id, firstParent.id);
		await repository.setScopeParent(child.id, secondParent.id);
		const activeParents = (await repository.listIntersections()).filter(
			(intersection) => intersection.kind === 'child_of' && intersection.fromId === child.id
		);
		expect(activeParents).toHaveLength(1);
		expect(activeParents[0]?.toId).toBe(secondParent.id);

		await repository.setScopeParent(firstParent.id, child.id);
		await expect(repository.setScopeParent(child.id, firstParent.id)).rejects.toThrow(
			'Scope hierarchy integrity conflict: cycle'
		);
	});

	it('enforces Scope hierarchy integrity through the generic Intersection path', async () => {
		const repository = createTraceRepository(createFakeClient());
		const child = await repository.createScope({ name: 'Child' });
		const firstParent = await repository.createScope({ name: 'First parent' });
		const secondParent = await repository.createScope({ name: 'Second parent' });

		const firstLink = await repository.createIntersection({
			fromId: child.id,
			toId: firstParent.id,
			kind: 'child_of'
		});
		const sameLink = await repository.createIntersection({
			fromId: child.id,
			toId: firstParent.id,
			kind: 'child_of'
		});

		expect(sameLink.id).toBe(firstLink.id);
		expect(await repository.listLogs(firstLink.id)).toHaveLength(1);
		await expect(
			repository.createIntersection({
				fromId: child.id,
				toId: secondParent.id,
				kind: 'child_of'
			})
		).rejects.toThrow('multiple structural parents');
		await expect(
			repository.createIntersection({
				fromId: firstParent.id,
				toId: child.id,
				kind: 'child_of'
			})
		).rejects.toThrow('Scope hierarchy integrity conflict: cycle');
		await expect(
			repository.createIntersection({
				fromId: child.id,
				toId: 'missing-parent',
				kind: 'child_of'
			})
		).rejects.toThrow('scopes entity not found: missing-parent');

		expect(
			(await repository.listIntersections()).filter(
				(intersection) => intersection.kind === 'child_of'
			)
		).toEqual([expect.objectContaining({ id: firstLink.id, toId: firstParent.id })]);
	});

	it('rejects child_of restore conflicts and cycles without changing the deleted link', async () => {
		const repository = createTraceRepository(createFakeClient());
		const child = await repository.createScope({ name: 'Child' });
		const firstParent = await repository.createScope({ name: 'First parent' });
		const secondParent = await repository.createScope({ name: 'Second parent' });
		const firstLink = await repository.setScopeParent(child.id, firstParent.id);
		if (!firstLink) throw new Error('Expected first parent link');
		await repository.setIntersectionDeleted(firstLink.id, true);
		await repository.setScopeParent(child.id, secondParent.id);

		await expect(repository.setIntersectionDeleted(firstLink.id, false)).rejects.toThrow(
			'multiple structural parents'
		);
		expect(
			(await repository.listIntersections(true)).find(
				(intersection) => intersection.id === firstLink.id
			)
		).toMatchObject({ isDeleted: true });

		const cycleChild = await repository.createScope({ name: 'Cycle child' });
		const cycleParent = await repository.createScope({ name: 'Cycle parent' });
		const cycleLink = await repository.setScopeParent(cycleChild.id, cycleParent.id);
		if (!cycleLink) throw new Error('Expected cycle candidate link');
		await repository.setIntersectionDeleted(cycleLink.id, true);
		await repository.setScopeParent(cycleParent.id, cycleChild.id);

		await expect(repository.setIntersectionDeleted(cycleLink.id, false)).rejects.toThrow(
			'Scope hierarchy integrity conflict: cycle'
		);
		expect(
			(await repository.listIntersections(true)).find(
				(intersection) => intersection.id === cycleLink.id
			)
		).toMatchObject({ isDeleted: true });
	});

	it('audits seeded hierarchy corruption and requires explicit edge deletion before repair', async () => {
		const client = createFakeClient();
		const repository = createTraceRepository(client);
		const child = await repository.createScope({ name: 'Child' });
		const firstParent = await repository.createScope({ name: 'First parent' });
		const secondParent = await repository.createScope({ name: 'Second parent' });
		const replacement = await repository.createScope({ name: 'Replacement' });
		const timestamp = '2026-08-25T12:00:00.000Z';
		const firstLinkId = `${child.id}:${firstParent.id}:child_of`;
		const secondLinkId = `${child.id}:${secondParent.id}:child_of`;
		await client.transact(async (transaction) => {
			for (const [id, parentId] of [
				[firstLinkId, firstParent.id],
				[secondLinkId, secondParent.id]
			] as const) {
				await transaction.insert('intersections', {
					id,
					fromId: child.id,
					toId: parentId,
					kind: 'child_of',
					context: null,
					isDeleted: false,
					createdAt: timestamp,
					updatedAt: timestamp
				});
			}
		});

		const logsBeforeAudit = await repository.listLogs();
		expect(await repository.auditScopeHierarchyIntegrity()).toEqual({
			ok: false,
			issues: [
				expect.objectContaining({
					kind: 'multiple_parents',
					childScopeId: child.id,
					parentScopeIds: [firstParent.id, secondParent.id].toSorted()
				})
			]
		});
		expect(await repository.listLogs()).toEqual(logsBeforeAudit);
		await expect(repository.setScopeParent(child.id, null)).rejects.toThrow(
			'multiple structural parents'
		);
		await expect(repository.setScopeParent(child.id, replacement.id)).rejects.toThrow(
			'multiple structural parents'
		);
		expect(
			(await repository.listIntersections()).filter(
				(intersection) => intersection.fromId === child.id
			)
		).toHaveLength(2);

		await repository.setIntersectionDeleted(firstLinkId, true);
		expect(await repository.auditScopeHierarchyIntegrity()).toEqual({ ok: true, issues: [] });
		await repository.setScopeParent(child.id, replacement.id);
		expect(
			(await repository.listIntersections()).filter(
				(intersection) => intersection.fromId === child.id
			)
		).toEqual([expect.objectContaining({ toId: replacement.id })]);
	});

	it('reports synced Scope cycles and missing endpoints without writing data', async () => {
		const client = createFakeClient();
		const repository = createTraceRepository(client);
		const first = await repository.createScope({ name: 'First' });
		const second = await repository.createScope({ name: 'Second' });
		const timestamp = '2026-08-25T12:00:00.000Z';
		await client.transact(async (transaction) => {
			for (const row of [
				{
					id: `${first.id}:${second.id}:child_of`,
					fromId: first.id,
					toId: second.id
				},
				{
					id: `${second.id}:${first.id}:child_of`,
					fromId: second.id,
					toId: first.id
				},
				{
					id: `${first.id}:missing-scope:child_of`,
					fromId: first.id,
					toId: 'missing-scope'
				}
			]) {
				await transaction.insert('intersections', {
					...row,
					kind: 'child_of',
					context: null,
					isDeleted: false,
					createdAt: timestamp,
					updatedAt: timestamp
				});
			}
		});
		const intersectionsBefore = await repository.listIntersections(true);
		const logsBefore = await repository.listLogs();

		const report = await repository.auditScopeHierarchyIntegrity();

		expect(report.ok).toBe(false);
		expect(report.issues).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: 'missing_scope',
					endpoint: 'parent',
					scopeId: 'missing-scope'
				}),
				expect.objectContaining({ kind: 'cycle' })
			])
		);
		expect(await repository.listIntersections(true)).toEqual(intersectionsBefore);
		expect(await repository.listLogs()).toEqual(logsBefore);
	});

	it('migrates a legacy parentScopeId into an idempotent child_of Intersection', async () => {
		const client = createFakeClient();
		await client.transact(async (transaction) => {
			await transaction.insert('scopes', {
				id: 'legacy-parent',
				name: 'Legacy parent',
				parentScopeId: null,
				startedAt: null,
				endedAt: null,
				isDeleted: false,
				createdAt: '2026-08-01T00:00:00.000Z',
				updatedAt: '2026-08-01T00:00:00.000Z'
			});
			await transaction.insert('scopes', {
				id: 'legacy-child',
				name: 'Legacy child',
				parentScopeId: 'legacy-parent',
				startedAt: null,
				endedAt: null,
				isDeleted: false,
				createdAt: '2026-08-01T00:00:00.000Z',
				updatedAt: '2026-08-01T00:00:00.000Z'
			});
		});

		const repository = createTraceRepository(client);
		expect(await repository.migrateLegacyScopeParents()).toBe(1);
		expect(await repository.migrateLegacyScopeParents()).toBe(0);
		expect(
			(await repository.listScopes(true)).find((scope) => scope.id === 'legacy-child')
				?.parentScopeId
		).toBe(null);
		expect(await repository.listIntersections()).toEqual([
			expect.objectContaining({
				fromId: 'legacy-child',
				toId: 'legacy-parent',
				kind: 'child_of'
			})
		]);
	});

	it('detects raw multi-parent corruption through the actual Triplit schema', async () => {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		const repository = createTriplitRepository(client);

		try {
			const child = await repository.createScope({ name: 'Child' });
			const firstParent = await repository.createScope({ name: 'First parent' });
			const secondParent = await repository.createScope({ name: 'Second parent' });
			const replacement = await repository.createScope({ name: 'Replacement' });
			const timestamp = '2026-08-25T12:00:00.000Z';
			const firstLinkId = `${child.id}:${firstParent.id}:child_of`;
			const secondLinkId = `${child.id}:${secondParent.id}:child_of`;
			await client.transact(async (transaction) => {
				await transaction.insert('intersections', {
					id: firstLinkId,
					fromId: child.id,
					toId: firstParent.id,
					kind: 'child_of',
					context: null,
					isDeleted: false,
					createdAt: timestamp,
					updatedAt: timestamp
				});
				await transaction.insert('intersections', {
					id: secondLinkId,
					fromId: child.id,
					toId: secondParent.id,
					kind: 'child_of',
					context: null,
					isDeleted: false,
					createdAt: timestamp,
					updatedAt: timestamp
				});
			});

			expect(await repository.auditScopeHierarchyIntegrity()).toMatchObject({
				ok: false,
				issues: [expect.objectContaining({ kind: 'multiple_parents', childScopeId: child.id })]
			});
			await expect(repository.setScopeParent(child.id, replacement.id)).rejects.toThrow(
				'multiple structural parents'
			);
			const storedBeforeRepair = await client.fetch(client.query('intersections'), {
				policy: 'local-only'
			});
			expect(storedBeforeRepair.filter((intersection) => !intersection.isDeleted)).toHaveLength(2);

			await repository.setIntersectionDeleted(firstLinkId, true);
			expect(await repository.auditScopeHierarchyIntegrity()).toEqual({ ok: true, issues: [] });
			await repository.setScopeParent(child.id, replacement.id);
			const storedAfterRepair = await client.fetch(client.query('intersections'), {
				policy: 'local-only'
			});
			expect(storedAfterRepair.filter((intersection) => !intersection.isDeleted)).toEqual([
				expect.objectContaining({ fromId: child.id, toId: replacement.id })
			]);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});

	it('creates contextual Trace-to-Trace links', async () => {
		const repository = createTraceRepository(createFakeClient());
		const source = await repository.createTrace({ ...traceDraft, content: 'Source' });
		const target = await repository.createTrace({ ...traceDraft, content: 'Target' });

		const relation = await repository.linkTraceToTrace(
			source.id,
			target.id,
			'revisits',
			'New context over the earlier trace'
		);

		expect(relation).toMatchObject({
			fromId: source.id,
			toId: target.id,
			kind: 'revisits',
			context: 'New context over the earlier trace'
		});
	});

	it('creates recursive Trace composition with multiple parents', async () => {
		const repository = createTraceRepository(createFakeClient());
		const firstWhole = await repository.createTrace({
			...traceDraft,
			content: 'First whole'
		});
		const secondWhole = await repository.createTrace({
			...traceDraft,
			content: 'Second whole'
		});
		const part = await repository.createTrace({ ...traceDraft, content: 'Shared part' });
		const nestedPart = await repository.createTrace({ ...traceDraft, content: 'Nested part' });

		await repository.linkTraceToTrace(part.id, firstWhole.id, 'part_of');
		await repository.linkTraceToTrace(part.id, secondWhole.id, 'part_of');
		await repository.linkTraceToTrace(nestedPart.id, part.id, 'part_of');

		const composition = (await repository.listIntersections()).filter(
			(intersection) => intersection.kind === 'part_of'
		);
		expect(composition).toHaveLength(3);
		expect(composition).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ fromId: part.id, toId: firstWhole.id }),
				expect.objectContaining({ fromId: part.id, toId: secondWhole.id }),
				expect.objectContaining({ fromId: nestedPart.id, toId: part.id })
			])
		);
	});

	it('prevents Trace composition cycles on creation and restoration', async () => {
		const repository = createTraceRepository(createFakeClient());
		const whole = await repository.createTrace({ ...traceDraft, content: 'Whole' });
		const part = await repository.createTrace({ ...traceDraft, content: 'Part' });
		const nestedPart = await repository.createTrace({ ...traceDraft, content: 'Nested part' });
		const partLink = await repository.linkTraceToTrace(part.id, whole.id, 'part_of');
		await repository.linkTraceToTrace(nestedPart.id, part.id, 'part_of');

		await expect(repository.linkTraceToTrace(whole.id, nestedPart.id, 'part_of')).rejects.toThrow(
			'Trace composition cannot contain a cycle'
		);

		await repository.setIntersectionDeleted(partLink.id, true);
		await repository.linkTraceToTrace(whole.id, nestedPart.id, 'part_of');
		await expect(repository.setIntersectionDeleted(partLink.id, false)).rejects.toThrow(
			'Trace composition cannot contain a cycle'
		);
		expect(
			(await repository.listIntersections(true)).find(
				(intersection) => intersection.id === partLink.id
			)
		).toMatchObject({ isDeleted: true });
	});

	it('validates part_of endpoints through the generic Intersection path', async () => {
		const repository = createTraceRepository(createFakeClient());
		const trace = await repository.createTrace(traceDraft);
		const scope = await repository.createScope({ name: 'Not a Trace' });

		await expect(
			repository.createIntersection({
				fromId: trace.id,
				toId: scope.id,
				kind: 'part_of'
			})
		).rejects.toThrow(`traces entity not found: ${scope.id}`);
		await expect(repository.linkTraceToTrace(trace.id, trace.id, 'part_of')).rejects.toThrow(
			'Trace cannot be part of itself'
		);
	});

	it('supports symmetric-style related_to Scope links', async () => {
		const repository = createTraceRepository(createFakeClient());
		const first = await repository.createScope({ name: 'First' });
		const second = await repository.createScope({ name: 'Second' });

		const relation = await repository.linkScopeToScope(
			first.id,
			second.id,
			'related_to',
			'Common context'
		);
		const reverse = await repository.linkScopeToScope(
			second.id,
			first.id,
			'related_to',
			'Common context'
		);

		expect(reverse.id).toBe(relation.id);
		expect(relation).toMatchObject({ kind: 'related_to', context: 'Common context' });
	});

	it('stores exact Citation ranges while keeping Source content immutable at the repository boundary', async () => {
		const repository = createTraceRepository(createFakeClient());
		const source = await repository.createSource({
			title: ' Voice note ',
			kind: 'voice_recollection',
			content: 'Первая фраза. Вторая фраза.',
			capturedAt: '2026-08-20T12:00:00.000Z'
		});
		const assertion = await repository.createAssertion({
			statement: 'Была вторая фраза',
			epistemicLayer: 'recollection',
			confidence: 'medium'
		});
		const quote = 'Вторая фраза';
		const startOffset = source.content.indexOf(quote);
		const citation = await repository.createCitation({
			assertionId: assertion.id,
			sourceId: source.id,
			startOffset,
			endOffset: startOffset + quote.length,
			label: ' Initial label '
		});

		const editedSource = await repository.editSource(source.id, { title: 'Voice transcript' });
		const editedCitation = await repository.editCitationLabel(citation.id, 'Exact sentence');

		expect(editedSource).toMatchObject({ title: 'Voice transcript', content: source.content });
		expect(source.content.slice(citation.startOffset, citation.endOffset)).toBe(quote);
		expect(editedCitation).toMatchObject({
			startOffset: citation.startOffset,
			endOffset: citation.endOffset,
			label: 'Exact sentence'
		});
		await expect(
			repository.createCitation({
				assertionId: assertion.id,
				sourceId: source.id,
				startOffset: 0,
				endOffset: source.content.length + 1
			})
		).rejects.toThrow('inside Source.content');
		expect((await repository.listLogs(citation.id)).map((log) => log.action)).toEqual([
			'updated',
			'linked'
		]);
	});

	it('locks Assertion semantics after first review and preserves reviewedAt through re-review', async () => {
		const repository = createTraceRepository(createFakeClient());
		const assertion = await repository.createAssertion({
			statement: 'Initial statement',
			epistemicLayer: 'interpretation',
			confidence: 'low'
		});
		const prepared = await repository.editAssertion(assertion.id, {
			statement: 'Prepared statement',
			confidence: 'medium'
		});
		const accepted = await repository.reviewAssertion(assertion.id, 'accepted');

		expect(prepared.reviewedAt).toBeNull();
		expect(accepted.reviewedAt).toEqual(expect.any(String));
		await expect(
			repository.editAssertion(assertion.id, { statement: 'Changed meaning' })
		).rejects.toThrow('locked after the first completed review');
		const noted = await repository.editAssertion(assertion.id, { note: 'Still editable' });
		const reopened = await repository.reopenAssertionReview(assertion.id);
		await expect(repository.editAssertion(assertion.id, { confidence: 'high' })).rejects.toThrow(
			'locked after the first completed review'
		);
		const acceptedAgain = await repository.reviewAssertion(assertion.id, 'accepted');
		const rejected = await repository.reviewAssertion(assertion.id, 'rejected');

		expect(noted.note).toBe('Still editable');
		expect(reopened).toMatchObject({ reviewStatus: 'unreviewed', reviewedAt: accepted.reviewedAt });
		expect(acceptedAgain.reviewedAt).toBe(accepted.reviewedAt);
		expect(rejected).toMatchObject({ reviewStatus: 'rejected', reviewedAt: accepted.reviewedAt });
		await expect(repository.reviewAssertion(assertion.id, 'accepted')).rejects.toThrow(
			'must be reopened'
		);
	});

	it('creates correction lineage and corrected status atomically', async () => {
		const repository = createTraceRepository(createFakeClient());
		const original = await repository.createAssertion({
			statement: 'The event happened in June',
			epistemicLayer: 'recollection',
			confidence: 'medium'
		});
		const accepted = await repository.reviewAssertion(original.id, 'accepted');
		const replacement = await repository.createAssertion({
			statement: 'The event happened in July',
			epistemicLayer: 'recollection',
			confidence: 'high'
		});
		const result = await repository.correctAssertion(original.id, replacement.id);
		const correctionLog = (await repository.listLogs(original.id))[0];
		const relationLog = (await repository.listLogs(result.relation.id))[0];

		expect(result.corrected).toMatchObject({
			reviewStatus: 'corrected',
			reviewedAt: accepted.reviewedAt
		});
		expect(result.relation).toMatchObject({
			fromAssertionId: replacement.id,
			toAssertionId: original.id,
			kind: 'corrects'
		});
		expect(relationLog?.operationId).toBe(correctionLog?.operationId);
		await expect(repository.setAssertionRelationDeleted(result.relation.id, true)).rejects.toThrow(
			'must keep an active replacement relation'
		);

		const untouched = await repository.createAssertion({
			statement: 'Untouched after failed correction',
			epistemicLayer: 'source_record',
			confidence: 'unknown'
		});
		const logCount = (await repository.listLogs()).length;
		await expect(repository.correctAssertion(untouched.id, 'missing-replacement')).rejects.toThrow(
			'assertions entity not found'
		);
		expect(
			(await repository.listAssertions()).find((item) => item.id === untouched.id)
		).toMatchObject({
			reviewStatus: 'unreviewed',
			reviewedAt: null
		});
		expect(await repository.listLogs()).toHaveLength(logCount);
	});

	it('canonicalizes Assertion conflicts and links only accepted evidence to a real target path', async () => {
		const repository = createTraceRepository(createFakeClient());
		const first = await repository.createAssertion({
			statement: 'First version',
			epistemicLayer: 'source_record',
			confidence: 'high'
		});
		const second = await repository.createAssertion({
			statement: 'Second version',
			epistemicLayer: 'source_record',
			confidence: 'high'
		});
		const conflict = await repository.createAssertionRelation({
			fromAssertionId: first.id,
			toAssertionId: second.id,
			kind: 'conflicts_with'
		});
		const reverse = await repository.createAssertionRelation({
			fromAssertionId: second.id,
			toAssertionId: first.id,
			kind: 'conflicts_with'
		});
		const trace = await repository.createTrace(traceDraft);

		expect(reverse.id).toBe(conflict.id);
		await expect(
			repository.linkAssertionToTarget({
				assertionId: first.id,
				targetType: 'trace',
				targetId: trace.id,
				targetPath: '/aboutTime/start'
			})
		).rejects.toThrow('Only an accepted Assertion');
		await repository.reviewAssertion(first.id, 'accepted');
		const link = await repository.linkAssertionToTarget({
			assertionId: first.id,
			targetType: 'trace',
			targetId: trace.id,
			targetPath: '/aboutTime/start'
		});
		const wholeRecordLink = await repository.linkAssertionToTarget({
			assertionId: first.id,
			targetType: 'trace',
			targetId: trace.id
		});

		expect(link.targetPath).toBe('/aboutTime/start');
		expect(wholeRecordLink.targetPath).toBeNull();
		await expect(
			repository.linkAssertionToTarget({
				assertionId: first.id,
				targetType: 'trace',
				targetId: trace.id,
				targetPath: '/aboutTime/missing'
			})
		).rejects.toThrow('targetPath does not resolve');
		expect((await repository.listLogs(link.id))[0]?.action).toBe('linked');
	});

	it('round-trips the provenance graph through the actual Triplit schema', async () => {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			autoConnect: false
		});
		const repository = createTriplitRepository(client);

		try {
			const source = await repository.createSource({
				title: 'Imported transcript',
				kind: 'voice_recollection',
				content: 'I moved to Belgrade in 2022.'
			});
			const assertion = await repository.createAssertion({
				statement: 'Moved to Belgrade in 2022',
				epistemicLayer: 'recollection',
				confidence: 'high'
			});
			const otherAssertion = await repository.createAssertion({
				statement: 'The move happened later',
				epistemicLayer: 'interpretation',
				confidence: 'low'
			});
			const citation = await repository.createCitation({
				assertionId: assertion.id,
				sourceId: source.id,
				startOffset: 0,
				endOffset: source.content.length
			});
			await repository.reviewAssertion(assertion.id, 'accepted');
			const trace = await repository.createTrace(traceDraft);
			const relation = await repository.createAssertionRelation({
				fromAssertionId: assertion.id,
				toAssertionId: otherAssertion.id,
				kind: 'conflicts_with'
			});
			const link = await repository.linkAssertionToTarget({
				assertionId: assertion.id,
				targetType: 'trace',
				targetId: trace.id,
				targetPath: '/aboutTime/start'
			});
			const [sources, assertions, citations, relations, links] = await Promise.all([
				client.fetch(client.query('sources'), { policy: 'local-only' }),
				client.fetch(client.query('assertions'), { policy: 'local-only' }),
				client.fetch(client.query('citations'), { policy: 'local-only' }),
				client.fetch(client.query('assertionRelations'), { policy: 'local-only' }),
				client.fetch(client.query('provenanceLinks'), { policy: 'local-only' })
			]);

			expect(sources).toEqual([
				expect.objectContaining({ id: source.id, content: source.content })
			]);
			expect(assertions).toHaveLength(2);
			expect(citations).toEqual([
				expect.objectContaining({
					id: citation.id,
					startOffset: 0,
					endOffset: source.content.length
				})
			]);
			expect(relations).toEqual([expect.objectContaining({ id: relation.id })]);
			expect(links).toEqual([
				expect.objectContaining({ id: link.id, targetPath: '/aboutTime/start' })
			]);
		} finally {
			await client.clear({ full: true });
			client.disconnect();
		}
	});
});
