import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';
import type { TraceDatasetSnapshot } from './trace-dataset';
import { traceSchemaProjections } from '$lib/model/TraceForm/TraceForm';

it('reads missing historical fields, multi-choice values and a day without converting data to strings', async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	const repository = createTriplitRepository(client);
	let unsubscribe = () => {};
	try {
		const { kind, kindV } = await repository.createTraceKind({
			name: 'Замер',
			initialKindV: { dataSchema: { type: 'object', properties: { weight: { type: 'number' } } } }
		});
		const base = {
			content: 'Замер',
			capturedAt: '2026-09-08T12:00:00Z',
			timezone: 'UTC',
			kindId: kind.id,
			aboutKind: 'instant' as const,
			aboutTime: {
				basis: 'absolute' as const,
				precision: 'day' as const,
				certainty: 'exact' as const,
				start: '2026-09-08',
				end: null
			}
		};
		await repository.createTrace({ ...base, kindVId: kindV.id, data: { weight: 74 } });
		const second = await repository.createTraceKindV(kind.id, {
			dataSchema: {
				type: 'object',
				properties: {
					weight: { type: 'number' },
					note: { type: 'string' },
					tags: { type: 'array', uniqueItems: true, items: { type: 'string', enum: ['a', 'b'] } }
				}
			}
		});
		await repository.createTrace({
			...base,
			kindVId: second.id,
			data: { weight: 73, tags: ['b'] }
		});
		let result: TraceDatasetSnapshot | undefined;
		unsubscribe = repository.subscribeTraceDataset(
			{
				kindId: kind.id,
				columns: [
					{ key: 'date', source: 'core', field: 'aboutDate' },
					{ key: 'tags', source: 'data', path: ['tags'], expectedType: 'string[]' },
					{ key: 'note', source: 'data', path: ['note'], expectedType: 'string' }
				]
			},
			(snapshot) => {
				result = snapshot;
			}
		);
		await expect.poll(() => result?.status).toBe('ready');
		if (result?.status !== 'ready') throw new Error('Dataset did not become ready');
		expect(result.rows).toHaveLength(2);
		expect(result.rows.map((row) => row.values.date)).toEqual(['2026-09-08', '2026-09-08']);
		expect(result.rows.map((row) => row.values.note)).toEqual([null, null]);
		expect(result.rows.find((row) => row.kindVId === kindV.id)?.values.tags).toBeNull();
		expect(result.rows.find((row) => row.kindVId === second.id)?.values.tags).toEqual(['b']);
	} finally {
		unsubscribe();
		await client.clear({ full: true });
		client.disconnect();
	}
});

it('projects nested repeated groups without creating additional canonical traces', async () => {
	const client = new TriplitClient({ schema, storage: { type: 'memory' }, autoConnect: false });
	const repository = createTriplitRepository(client);
	let unsubscribe = () => {};
	try {
		const dataSchema = {
			type: 'object',
			properties: {
				entries: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							sub: {
								type: 'array',
								items: {
									type: 'object',
									properties: { count: { type: 'integer', title: 'Количество' } }
								}
							}
						}
					}
				}
			}
		};
		const { kind, kindV } = await repository.createTraceKind({
			name: 'Строки',
			initialKindV: { dataSchema }
		});
		const trace = await repository.createTrace({
			content: 'Строки',
			kindId: kind.id,
			kindVId: kindV.id,
			capturedAt: '2026-09-08T12:00:00Z',
			timezone: 'UTC',
			aboutKind: 'instant',
			aboutTime: { basis: 'unknown' },
			data: { entries: [{ sub: [{ count: 1 }, { count: 2 }] }, { sub: [{ count: 3 }] }] }
		});
		const projection = traceSchemaProjections(dataSchema)[0];
		expect(projection.repeat?.path).toEqual(['entries', '[]', 'sub']);
		let result: TraceDatasetSnapshot | undefined;
		unsubscribe = repository.subscribeTraceDataset(
			{
				kindId: kind.id,
				repeat: projection.repeat,
				columns: projection.columns.map((entry) => entry.column)
			},
			(snapshot) => {
				result = snapshot;
			}
		);
		await expect.poll(() => result?.status).toBe('ready');
		if (result?.status !== 'ready') throw new Error('Dataset did not become ready');
		expect(result.rows).toHaveLength(3);
		expect(new Set(result.rows.map((row) => row.traceId))).toEqual(new Set([trace.id]));
		expect(result.rows.map((row) => row.values[projection.columns[1].column.key])).toEqual([
			1, 2, 3
		]);
	} finally {
		unsubscribe();
		await client.clear({ full: true });
		client.disconnect();
	}
});
