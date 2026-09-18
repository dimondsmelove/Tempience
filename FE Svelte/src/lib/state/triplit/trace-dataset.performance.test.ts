import { performance } from 'node:perf_hooks';
import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import type { TempienceTriplitClient } from './client';
import { createTriplitRepository, type TempienceRepository } from './repository';
import { schema } from './schema';
import type { TraceDatasetSnapshot } from './trace-dataset';
import type { JsonObject } from './types';

const enabled = process.env.TEMPIENCE_TRACE_DATASET_PERF === '1';
const rowCount = Number(process.env.TEMPIENCE_TRACE_DATASET_PERF_ROWS ?? 100_000);
const batchSize = 1_000;
const selectionStride = 100;

const numberSchema: JsonObject = {
	type: 'object',
	additionalProperties: false,
	required: ['weight'],
	properties: {
		weight: { type: 'number' }
	}
};

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

const waitForSnapshot = (
	subscribe: (callback: (snapshot: TraceDatasetSnapshot) => void) => () => void,
	predicate: (snapshot: TraceDatasetSnapshot) => boolean,
	timeoutMs: number
): Promise<{ snapshot: TraceDatasetSnapshot; unsubscribe: () => void }> =>
	new Promise((resolve, reject) => {
		let unsubscribe = (): void => {};
		const timeout = setTimeout(() => {
			unsubscribe();
			reject(new Error(`Trace dataset performance subscription timed out after ${timeoutMs} ms`));
		}, timeoutMs);
		unsubscribe = subscribe((snapshot) => {
			if (!predicate(snapshot)) return;
			clearTimeout(timeout);
			resolve({ snapshot, unsubscribe });
		});
	});

it.skipIf(!enabled)(
	'projects a small live Scope dataset from a large Trace collection',
	async () => {
		if (!Number.isInteger(rowCount) || rowCount < selectionStride) {
			throw new Error('TEMPIENCE_TRACE_DATASET_PERF_ROWS must be an integer of at least 100');
		}

		const { client, repository } = createMemoryRepository();
		let unsubscribe = (): void => {};
		try {
			const { kind, kindV } = await repository.createTraceKind({
				name: 'Performance weight',
				initialKindV: { dataSchema: numberSchema }
			});
			const selectedScope = await repository.createScope({ name: 'Selected measurements' });
			const otherScope = await repository.createScope({ name: 'Other measurements' });
			const seedStartedAt = performance.now();

			for (let start = 0; start < rowCount; start += batchSize) {
				const end = Math.min(start + batchSize, rowCount);
				await client.transact(async (transaction) => {
					for (let index = start; index < end; index += 1) {
						const suffix = index.toString().padStart(7, '0');
						const traceId = `perf-trace-${suffix}`;
						const capturedAt = new Date(
							Date.UTC(2015, 0, 1) + index * 60 * 60 * 1_000
						).toISOString();
						await transaction.insert('traces', {
							id: traceId,
							capturedAt,
							timezone: 'UTC',
							aboutKind: 'instant',
							aboutAt: capturedAt,
							content: `Weight ${index}`,
							kindId: kind.id,
							kindVId: kindV.id,
							data: { weight: index },
							isDeleted: false,
							createdAt: capturedAt,
							updatedAt: capturedAt
						});
						await transaction.insert('intersections', {
							id: `perf-membership-${suffix}`,
							fromId: traceId,
							toId: index % selectionStride === 0 ? selectedScope.id : otherScope.id,
							kind: 'belongs_to',
							isDeleted: false,
							createdAt: capturedAt,
							updatedAt: capturedAt
						});
					}
				});
			}
			const seedMs = performance.now() - seedStartedAt;

			const selectedCount = Math.ceil(rowCount / selectionStride);
			const firstReadyStartedAt = performance.now();
			let latestSnapshot: TraceDatasetSnapshot | undefined;
			let updateResolver: ((snapshot: TraceDatasetSnapshot) => void) | undefined;
			const firstReady = await waitForSnapshot(
				(callback) =>
					repository.subscribeTraceDataset(
						{
							kindId: kind.id,
							scope: { id: selectedScope.id, mode: 'direct' },
							filters: [
								{
									path: ['weight'],
									expectedType: 'number',
									operator: '>=',
									value: 0
								}
							],
							columns: [
								{ key: 'capturedAt', source: 'core', field: 'capturedAt' },
								{ key: 'weight', source: 'data', path: ['weight'], expectedType: 'number' }
							],
							order: { field: 'capturedAt', direction: 'DESC' },
							limit: selectedCount
						},
						(snapshot) => {
							latestSnapshot = snapshot;
							callback(snapshot);
							updateResolver?.(snapshot);
						}
					),
				(snapshot) => snapshot.status === 'ready' && snapshot.rows.length === selectedCount,
				30_000
			);
			unsubscribe = firstReady.unsubscribe;
			const firstReadyMs = performance.now() - firstReadyStartedAt;
			expect(firstReady.snapshot).toMatchObject({
				status: 'ready',
				resolvedScopeIds: [selectedScope.id]
			});

			const selectedIndex = Math.floor((rowCount - 1) / selectionStride) * selectionStride;
			const selectedTraceId = `perf-trace-${selectedIndex.toString().padStart(7, '0')}`;
			const updatedWeight = rowCount + 0.5;
			const updateSnapshot = new Promise<TraceDatasetSnapshot>((resolve, reject) => {
				const timeout = setTimeout(
					() => reject(new Error('Trace dataset live update timed out after 5000 ms')),
					5_000
				);
				updateResolver = (snapshot) => {
					if (
						snapshot.status !== 'ready' ||
						snapshot.rows.find((row) => row.traceId === selectedTraceId)?.values.weight !==
							updatedWeight
					) {
						return;
					}
					clearTimeout(timeout);
					resolve(snapshot);
				};
			});
			const updateStartedAt = performance.now();
			await repository.editTrace(selectedTraceId, { data: { weight: updatedWeight } });
			await updateSnapshot;
			const updateMs = performance.now() - updateStartedAt;

			expect(latestSnapshot?.status).toBe('ready');
			expect(firstReadyMs).toBeLessThan(10_000);
			expect(updateMs).toBeLessThan(2_000);
			console.info(
				JSON.stringify({
					traceRows: rowCount,
					intersectionRows: rowCount,
					projectedRows: selectedCount,
					seedMs: Math.round(seedMs),
					firstReadyMs: Math.round(firstReadyMs),
					updateMs: Math.round(updateMs)
				})
			);
		} finally {
			unsubscribe();
			await client.clear({ full: true });
			client.disconnect();
		}
	},
	180_000
);
