import { TriplitClient } from '@triplit/client';
import { describe, expect, it } from 'vitest';
import type { TempienceTriplitClient } from './client';
import { createTriplitRepository, type TempienceRepository } from './repository';
import { schema } from './schema';
import type { TraceDatasetRequest, TraceDatasetSnapshot } from './trace-dataset';
import type { JsonObject, TraceDraft } from './types';

const numberSchema: JsonObject = {
	type: 'object',
	additionalProperties: false,
	required: ['weight'],
	properties: {
		weight: { type: 'number' }
	}
};

const stringSchema: JsonObject = {
	...numberSchema,
	properties: {
		weight: { type: 'string' }
	}
};

const traceDraft = (
	content: string,
	capturedAt: string,
	kindId: string,
	kindVId: string,
	weight: number | string
): TraceDraft => ({
	content,
	capturedAt,
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'minute',
		certainty: 'exact',
		start: capturedAt,
		end: null
	},
	kindId,
	kindVId,
	data: { weight }
});

const createMemoryRepository = (): {
	client: TempienceTriplitClient;
	repository: TempienceRepository;
} => {
	const client = new TriplitClient({
		schema,
		storage: { type: 'memory' },
		autoConnect: false
	});
	return { client, repository: createTriplitRepository(client) };
};

const disposeMemoryRepository = async (client: TempienceTriplitClient): Promise<void> => {
	await client.clear({ full: true });
	client.disconnect();
};

type SnapshotProbe = {
	waitFor: (
		predicate: (snapshot: TraceDatasetSnapshot) => boolean,
		label?: string
	) => Promise<TraceDatasetSnapshot>;
	unsubscribe: () => void;
};

const subscribeProbe = (
	repository: TempienceRepository,
	request: TraceDatasetRequest
): SnapshotProbe => {
	const snapshots: TraceDatasetSnapshot[] = [];
	const waiters = new Set<{
		predicate: (snapshot: TraceDatasetSnapshot) => boolean;
		resolve: (snapshot: TraceDatasetSnapshot) => void;
		reject: (cause: unknown) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	const unsubscribe = repository.subscribeTraceDataset(request, (snapshot) => {
		snapshots.push(snapshot);
		for (const waiter of waiters) {
			if (!waiter.predicate(snapshot)) continue;
			clearTimeout(waiter.timer);
			waiters.delete(waiter);
			waiter.resolve(snapshot);
		}
	});

	return {
		waitFor: (predicate, label = 'unnamed wait') => {
			const current = snapshots.at(-1);
			if (current && predicate(current)) return Promise.resolve(current);
			return new Promise((resolve, reject) => {
				const waiter = {
					predicate,
					resolve,
					reject,
					timer: setTimeout(() => {
						waiters.delete(waiter);
						reject(
							new Error(
								`Timed out during ${label}. Last snapshot: ${JSON.stringify(snapshots.at(-1))}`
							)
						);
					}, 3000)
				};
				waiters.add(waiter);
			});
		},
		unsubscribe: () => {
			unsubscribe();
			for (const waiter of waiters) {
				clearTimeout(waiter.timer);
				waiter.reject(new Error('Trace dataset probe was disposed'));
			}
			waiters.clear();
		}
	};
};

const contentRequest = (
	kindId: string,
	scope: TraceDatasetRequest['scope']
): TraceDatasetRequest => ({
	kindId,
	...(scope ? { scope } : {}),
	columns: [{ key: 'content', source: 'core', field: 'content' }],
	order: { field: 'capturedAt', direction: 'ASC' }
});

describe('live Trace datasets', () => {
	it('rejects an implicit or unknown Scope mode', async () => {
		const { client, repository } = createMemoryRepository();
		let probe: SnapshotProbe | undefined;
		try {
			probe = subscribeProbe(repository, {
				kindId: 'kind',
				scope: { id: 'scope', mode: undefined as never },
				columns: [{ key: 'content', source: 'core', field: 'content' }]
			});
			const snapshot = await probe.waitFor((value) => value.status === 'error');
			expect(snapshot).toMatchObject({
				status: 'error',
				message: 'Trace dataset scope mode must be direct or subtree'
			});
		} finally {
			probe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});

	it('keeps direct Scope membership and subtree traversal behind one subscription', async () => {
		const { client, repository } = createMemoryRepository();
		let directProbe: SnapshotProbe | undefined;
		let subtreeProbe: SnapshotProbe | undefined;
		try {
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Weight',
				initialKindV: { dataSchema: numberSchema }
			});
			const root = await repository.createScope({ name: 'Health' });
			const child = await repository.createScope({ name: 'Body metrics', parentScopeId: root.id });
			const grandchild = await repository.createScope({ name: 'Weight', parentScopeId: child.id });
			const unrelated = await repository.createScope({ name: 'Travel' });

			const rootTrace = await repository.createTraceWithScope(
				traceDraft('Root', '2026-08-01T08:00:00.000Z', kind.id, kindV.id, 72),
				root.id
			);
			const childTrace = await repository.createTraceWithScope(
				traceDraft('Child', '2026-08-02T08:00:00.000Z', kind.id, kindV.id, 71),
				child.id
			);
			const grandchildTrace = await repository.createTraceWithScope(
				traceDraft('Grandchild', '2026-08-03T08:00:00.000Z', kind.id, kindV.id, 70),
				grandchild.id
			);
			await repository.createTraceWithScope(
				traceDraft('Unrelated', '2026-08-04T08:00:00.000Z', kind.id, kindV.id, 69),
				unrelated.id
			);
			directProbe = subscribeProbe(
				repository,
				contentRequest(kind.id, { id: root.id, mode: 'direct' })
			);
			subtreeProbe = subscribeProbe(
				repository,
				contentRequest(kind.id, { id: root.id, mode: 'subtree' })
			);

			const direct = await directProbe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 1,
				'initial direct query'
			);
			const subtree = await subtreeProbe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 3,
				'initial subtree query'
			);
			expect(direct).toMatchObject({
				status: 'ready',
				resolvedScopeIds: [root.id],
				rows: [{ traceId: rootTrace.id, values: { content: 'Root' } }]
			});
			expect(subtree).toMatchObject({
				status: 'ready',
				resolvedScopeIds: [child.id, grandchild.id, root.id].toSorted()
			});
			if (subtree.status !== 'ready') throw new Error('Expected a ready subtree dataset');
			expect(subtree.rows.map((row) => row.traceId)).toEqual([
				rootTrace.id,
				childTrace.id,
				grandchildTrace.id
			]);

			const parentLink = (await repository.listIntersections()).find(
				(intersection) =>
					intersection.kind === 'child_of' &&
					intersection.fromId === child.id &&
					intersection.toId === root.id
			);
			if (!parentLink) throw new Error('Expected the child Scope parent link');
			await repository.setIntersectionDeleted(parentLink.id, true);
			const detached = await subtreeProbe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 1,
				'detached child subtree'
			);
			expect(detached).toMatchObject({
				status: 'ready',
				resolvedScopeIds: [root.id],
				rows: [{ traceId: rootTrace.id }]
			});

			await repository.setIntersectionDeleted(parentLink.id, false);
			await subtreeProbe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 3,
				'restored parent link'
			);
			await repository.setScopeDeleted(child.id, true);
			const archived = await subtreeProbe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 1,
				'archived child scope'
			);
			expect(archived).toMatchObject({ status: 'ready', resolvedScopeIds: [root.id] });
			await repository.setScopeDeleted(child.id, false);
			await subtreeProbe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 3,
				'restored child scope'
			);
		} finally {
			directProbe?.unsubscribe();
			subtreeProbe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});

	it('reacts to membership and Trace value changes without exposing Intersections', async () => {
		const { client, repository } = createMemoryRepository();
		let probe: SnapshotProbe | undefined;
		try {
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Weight',
				initialKindV: { dataSchema: numberSchema }
			});
			const scope = await repository.createScope({ name: 'Health' });
			const trace = await repository.createTrace(
				traceDraft('Morning weight', '2026-08-20T08:00:00.000Z', kind.id, kindV.id, 72)
			);
			probe = subscribeProbe(repository, {
				kindId: kind.id,
				scope: { id: scope.id, mode: 'direct' },
				columns: [{ key: 'value', source: 'data', path: ['weight'], expectedType: 'number' }]
			});

			await probe.waitFor((snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 0);
			const membership = await repository.linkTraceToScope(trace.id, scope.id);
			const linked = await probe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows[0]?.values.value === 72
			);
			expect(linked).toMatchObject({
				status: 'ready',
				rows: [{ traceId: trace.id, kindVId: kindV.id, values: { value: 72 } }]
			});

			await repository.editTrace(trace.id, { data: { weight: 71.5 } });
			await probe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows[0]?.values.value === 71.5
			);
			await repository.setIntersectionDeleted(membership.id, true);
			await probe.waitFor((snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 0);
		} finally {
			probe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});

	it('applies typed data filters, time bounds, ordering, and limits in the Triplit query', async () => {
		const { client, repository } = createMemoryRepository();
		let probe: SnapshotProbe | undefined;
		try {
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Weight',
				initialKindV: { dataSchema: numberSchema }
			});
			await repository.createTrace(
				traceDraft('Outside', '2026-07-31T08:00:00.000Z', kind.id, kindV.id, 90)
			);
			const first = await repository.createTrace(
				traceDraft('First', '2026-08-01T08:00:00.000Z', kind.id, kindV.id, 70)
			);
			const second = await repository.createTrace(
				traceDraft('Second', '2026-08-02T08:00:00.000Z', kind.id, kindV.id, 72)
			);
			await repository.createTrace(
				traceDraft('Filtered', '2026-08-03T08:00:00.000Z', kind.id, kindV.id, 69)
			);
			const third = await repository.createTrace(
				traceDraft('Third', '2026-08-04T08:00:00.000Z', kind.id, kindV.id, 71)
			);

			probe = subscribeProbe(repository, {
				kindId: kind.id,
				time: { field: 'aboutAt', from: '2026-08-01T00:00:00.000Z' },
				filters: [{ path: ['weight'], expectedType: 'number', operator: '>=', value: 70 }],
				columns: [
					{ key: 'content', source: 'core', field: 'content' },
					{ key: 'value', source: 'data', path: ['weight'], expectedType: 'number' }
				],
				order: { field: 'aboutAt', direction: 'DESC' },
				limit: 2
			});

			const snapshot = await probe.waitFor(
				(value) => value.status === 'ready' && value.rows.length === 2
			);
			expect(snapshot).toMatchObject({
				status: 'ready',
				rows: [
					{ traceId: third.id, values: { content: 'Third', value: 71 } },
					{ traceId: second.id, values: { content: 'Second', value: 72 } }
				]
			});
			expect(snapshot).not.toMatchObject({ rows: [{ traceId: first.id }] });
		} finally {
			probe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});

	it('stops a typed projection when one TraceKindV gives the same field an incompatible type', async () => {
		const { client, repository } = createMemoryRepository();
		let probe: SnapshotProbe | undefined;
		try {
			const initial = await repository.createTraceKind({
				name: 'Weight',
				initialKindV: { dataSchema: stringSchema }
			});
			await repository.createTrace(
				traceDraft(
					'Legacy string',
					'2026-08-01T08:00:00.000Z',
					initial.kind.id,
					initial.kindV.id,
					'72'
				)
			);
			const numericKindV = await repository.createTraceKindV(initial.kind.id, {
				dataSchema: numberSchema
			});
			await repository.createTrace(
				traceDraft('Numeric', '2026-08-02T08:00:00.000Z', initial.kind.id, numericKindV.id, 72)
			);

			probe = subscribeProbe(repository, {
				kindId: initial.kind.id,
				columns: [{ key: 'value', source: 'data', path: ['weight'], expectedType: 'number' }]
			});
			const snapshot = await probe.waitFor((value) => value.status === 'incompatible');
			expect(snapshot).toEqual({
				status: 'incompatible',
				kindId: initial.kind.id,
				resolvedScopeIds: null,
				issues: [
					{
						kindVId: initial.kindV.id,
						generation: 1,
						path: ['weight'],
						expectedType: 'number',
						actualType: 'string',
						reason: 'type_mismatch'
					}
				]
			});
		} finally {
			probe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});

	it('keeps the same field path usable across compatible TraceKindV versions', async () => {
		const { client, repository } = createMemoryRepository();
		let probe: SnapshotProbe | undefined;
		try {
			const initial = await repository.createTraceKind({
				name: 'Weight',
				initialKindV: { dataSchema: numberSchema }
			});
			const nextKindV = await repository.createTraceKindV(initial.kind.id, {
				dataSchema: {
					...numberSchema,
					properties: {
						weight: { type: 'number' },
						note: { type: 'string' }
					}
				}
			});
			await repository.createTrace(
				traceDraft('First', '2026-08-01T08:00:00.000Z', initial.kind.id, initial.kindV.id, 72)
			);
			await repository.createTrace(
				traceDraft('Second', '2026-08-02T08:00:00.000Z', initial.kind.id, nextKindV.id, 71)
			);

			probe = subscribeProbe(repository, {
				kindId: initial.kind.id,
				columns: [{ key: 'value', source: 'data', path: ['weight'], expectedType: 'number' }],
				order: { field: 'capturedAt', direction: 'ASC' }
			});
			const snapshot = await probe.waitFor(
				(value) => value.status === 'ready' && value.rows.length === 2
			);
			expect(snapshot).toMatchObject({
				status: 'ready',
				rows: [{ values: { value: 72 } }, { values: { value: 71 } }]
			});
		} finally {
			probe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});

	it('expands a repeated object field into derived rows while keeping one canonical Trace', async () => {
		const { client, repository } = createMemoryRepository();
		let probe: SnapshotProbe | undefined;
		try {
			const receiptSchema: JsonObject = {
				type: 'object',
				additionalProperties: false,
				required: ['store', 'items'],
				properties: {
					store: { type: 'string' },
					items: {
						type: 'array',
						minItems: 1,
						items: {
							type: 'object',
							additionalProperties: false,
							required: ['name', 'amount', 'category'],
							properties: {
								name: { type: 'string' },
								amount: { type: 'number' },
								category: { type: 'string' }
							}
						}
					}
				}
			};
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Shopping trip',
				initialKindV: { dataSchema: receiptSchema }
			});
			const trace = await repository.createTrace({
				content: 'Maxi',
				capturedAt: '2026-08-20T08:00:00.000Z',
				timezone: 'Europe/Belgrade',
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-08-20T07:45:00.000Z',
					end: null
				},
				kindId: kind.id,
				kindVId: kindV.id,
				data: {
					store: 'Maxi',
					items: [
						{ name: 'Milk', amount: 180, category: 'food' },
						{ name: 'Coffee', amount: 620, category: 'food' }
					]
				}
			});

			probe = subscribeProbe(repository, {
				kindId: kind.id,
				repeat: { path: ['items'] },
				columns: [
					{ key: 'when', source: 'core', field: 'aboutAt' },
					{ key: 'store', source: 'data', path: ['store'], expectedType: 'string' },
					{ key: 'name', source: 'item', path: ['name'], expectedType: 'string' },
					{ key: 'amount', source: 'item', path: ['amount'], expectedType: 'number' }
				]
			});

			const initial = await probe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 2
			);
			expect(initial).toMatchObject({
				status: 'ready',
				rows: [
					{
						traceId: trace.id,
						kindVId: kindV.id,
						itemIndex: 0,
						values: { when: '2026-08-20T07:45:00.000Z', store: 'Maxi', name: 'Milk', amount: 180 }
					},
					{
						traceId: trace.id,
						kindVId: kindV.id,
						itemIndex: 1,
						values: { when: '2026-08-20T07:45:00.000Z', store: 'Maxi', name: 'Coffee', amount: 620 }
					}
				]
			});
			expect(await repository.listTraces()).toHaveLength(1);

			await repository.editTrace(trace.id, {
				data: {
					store: 'Maxi',
					items: [
						{ name: 'Milk', amount: 180, category: 'food' },
						{ name: 'Coffee', amount: 620, category: 'food' },
						{ name: 'Soap', amount: 250, category: 'home' }
					]
				}
			});
			const updated = await probe.waitFor(
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === 3
			);
			expect(updated).toMatchObject({ rows: [{}, {}, { values: { name: 'Soap', amount: 250 } }] });
			expect(await repository.listTraces()).toHaveLength(1);
		} finally {
			probe?.unsubscribe();
			await disposeMemoryRepository(client);
		}
	});
});
