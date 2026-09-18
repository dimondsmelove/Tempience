import { TriplitClient, Schema as S } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';
import { traceRevisions } from './Traces/revisions';

it('opens a stored schema without Trace revisions, keeps rows and Log, stamps new writes and refuses old ones', async () => {
	const withoutRevisions = S.Collections({
		...schema,
		traces: {
			schema: S.Schema(
				Object.fromEntries(
					Object.entries(schema.traces.schema.properties).filter(([key]) => key !== 'revisions')
				) as never
			),
			relationships: schema.traces.relationships
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: withoutRevisions, storage, autoConnect: false });
	// The previous build wrote the row and its journal directly; its readiness check would refuse now.
	const row = {
		id: 'trace:legacy',
		capturedAt: '2026-09-12T12:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: { basis: 'unknown' },
		aboutAt: null,
		aboutStart: null,
		aboutEnd: null,
		aboutTraceId: null,
		statedDuration: null,
		content: 'B',
		relation: 'actual',
		kindId: null,
		kindVId: null,
		data: null,
		isDeleted: false,
		createdAt: '2026-09-12T12:00:00.000Z',
		updatedAt: '2026-09-12T12:05:00.000Z'
	};
	await oldClient.insert('traces', row as never);
	await oldClient.insert('logs', {
		id: 'log:legacy-edit',
		operationId: 'op:legacy-edit',
		entityType: 'trace',
		entityId: row.id,
		action: 'updated',
		patchJson: JSON.stringify({ content: { before: 'A', after: 'B' } }),
		occurredAt: row.updatedAt,
		deviceId: 'device:legacy',
		actor: 'user',
		cause: 'normal'
	} as never);
	const traces = await oldClient.fetch(oldClient.query('traces'));
	const logs = await oldClient.fetch(oldClient.query('logs'));
	oldClient.disconnect();

	const events: string[] = [];
	const client = new TriplitClient({
		schema,
		storage,
		autoConnect: false,
		experimental: {
			onDatabaseInit: (_db, event) => {
				events.push(event.type);
			}
		}
	});
	try {
		await client.ready;
		expect(events).toEqual(['SUCCESS']);
		expect((await client.getSchema())?.collections.traces.schema.properties).toHaveProperty(
			'revisions'
		);
		expect(await client.fetch(client.query('traces'))).toEqual(traces);
		expect(await client.fetch(client.query('logs'))).toEqual(logs);
		const repo = createTriplitRepository(client);
		// The old build's edit left no stamps: its inverse is refused, never guessed from the value.
		await expect(repo.undoOperation('op:legacy-edit')).rejects.toMatchObject({
			code: 'undo_stale',
			details: { reason: 'revision', revision: null }
		});
		expect((await repo.listTraces()).find((trace) => trace.id === row.id)?.content).toBe('B');
		const edited = await repo.editTrace(row.id, { content: 'C' });
		expect(edited.content).toBe('C');
		const edit = (await repo.listLogs(row.id))[0].operationId;
		expect(traceRevisions((await client.fetchById('traces', row.id))!)).toEqual({ content: edit });
		await repo.undoOperation(edit);
		expect((await repo.listTraces()).find((trace) => trace.id === row.id)?.content).toBe('B');
		expect(await client.fetch(client.query('logs'))).toHaveLength(3);
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});
