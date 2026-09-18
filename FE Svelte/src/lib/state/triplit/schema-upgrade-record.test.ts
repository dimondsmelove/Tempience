import { TriplitClient, Schema as S } from '@triplit/client';
import { BTreeKVStore } from '@triplit/db/storage/memory-btree';
import { expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';
import { traceRecordText } from './Traces/fields';

it('opens a stored schema without the Trace description, keeps rows and Log, then saves one', async () => {
	const withoutDescription = S.Collections({
		...schema,
		traces: {
			schema: S.Schema(
				Object.fromEntries(
					Object.entries(schema.traces.schema.properties).filter(([key]) => key !== 'description')
				) as never
			),
			relationships: schema.traces.relationships
		}
	});
	const storage = new BTreeKVStore();
	const oldClient = new TriplitClient({ schema: withoutDescription, storage, autoConnect: false });
	// The previous build stored the row directly; its readiness check would refuse now.
	const row = {
		id: 'trace:legacy',
		capturedAt: '2026-09-12T12:00:00.000Z',
		timezone: 'UTC',
		aboutKind: 'instant',
		aboutTime: {
			basis: 'absolute',
			precision: 'day',
			certainty: 'exact',
			start: '2026-09-11',
			end: null
		},
		aboutAt: null,
		aboutStart: '2026-09-11',
		aboutEnd: '2026-09-11',
		aboutTraceId: null,
		statedDuration: null,
		content: 'Заголовок\n\nтекст записи',
		relation: 'actual',
		kindId: null,
		kindVId: null,
		data: null,
		isDeleted: false,
		createdAt: '2026-09-12T12:00:00.000Z',
		updatedAt: '2026-09-12T12:00:00.000Z'
	};
	await oldClient.insert('traces', row as never);
	await oldClient.insert('logs', {
		id: 'log:legacy',
		operationId: 'op:legacy',
		entityType: 'trace',
		entityId: row.id,
		action: 'created',
		patchJson: JSON.stringify({ snapshot: row }),
		occurredAt: row.createdAt,
		deviceId: 'device:legacy',
		actor: 'user',
		cause: 'user'
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
			'description'
		);
		expect(await client.fetch(client.query('traces'))).toEqual(traces);
		expect(await client.fetch(client.query('logs'))).toEqual(logs);
		const repo = createTriplitRepository(client);
		const legacy = (await repo.listTraces()).find((trace) => trace.id === row.id)!;
		expect(legacy.description).toBeNull();
		// Legacy content is read whole as the title; nothing is split into the new field.
		expect(traceRecordText(legacy)).toEqual({ title: row.content, description: null });
		const saved = await repo.saveTraceRecord({
			id: row.id,
			fields: { description: 'добавлено после обновления' }
		});
		expect(saved.trace).toMatchObject({
			content: row.content,
			description: 'добавлено после обновления'
		});
		expect((await client.fetchById('traces', row.id))?.description).toBe(
			'добавлено после обновления'
		);
		expect(await client.fetch(client.query('logs'))).toHaveLength(2);
	} finally {
		await client.clear({ full: true });
		client.disconnect();
	}
});
