import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository } from '../repository';
import { schema } from '../schema';
import { getPendingChangeCount } from '../sync-status';
import { canonical } from '../sync.fixture';
import type { JsonObject, TraceDraft } from '../types';

const serverUrl = process.env.TEMPIENCE_TEST_SYNC_URL;

const dataSchema: JsonObject = {
	type: 'object',
	properties: {
		note: { type: 'string' },
		count: { type: 'number' },
		mood: { type: ['string', 'null'] },
		nested: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } },
		only: { type: 'string' },
		other: { type: 'string' }
	}
};

it.runIf(serverUrl)(
	'replicates rewritten JSON fields atomically and merges independent edits across two clients',
	async () => {
		const url = new URL(serverUrl!);
		if (!['127.0.0.1', 'localhost'].includes(url.hostname))
			throw new Error('This probe requires an isolated loopback sync server.');
		const health = await fetch(new URL('/healthz', url)).then((response) => response.json());
		if (health.projectId !== 'tempience-34-synthetic') throw new Error('Unexpected sync project.');
		const clients: TriplitClient<typeof schema>[] = [];
		const unsubscribes: (() => void)[] = [];
		const errors: string[] = [];
		const fulfilled = new Set<number>();
		try {
			for (let index = 0; index < 2; index++) {
				const response = await fetch(new URL('/pair', url), {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						code: 'tempience-34-isolated-test-code',
						deviceId: crypto.randomUUID()
					})
				});
				if (!response.ok) throw new Error(`Pairing failed: ${response.status}`);
				const { token } = await response.json();
				const client = new TriplitClient({
					schema,
					storage: { type: 'memory' },
					serverUrl,
					token,
					autoConnect: true
				});
				clients.push(client);
				await client.ready;
				for (const collection of ['traces', 'traceKinds', 'traceKindVersions'] as const)
					unsubscribes.push(
						client.subscribe(
							client.query(collection) as never,
							() => {},
							(error) => {
								errors.push(`${index}:${collection}:${String(error)}`);
							},
							{
								onRemoteFulfilled: () => {
									if (collection === 'traces') fulfilled.add(index);
								}
							}
						)
					);
				unsubscribes.push(
					client.onFailureToSyncWrites((error) => {
						errors.push(`${index}:writes:${String(error)}`);
					})
				);
			}
			const [first, second] = clients.map(createTriplitRepository);
			const open = () => clients.every((client) => client.connectionStatus === 'OPEN');
			await expect.poll(open, { timeout: 10000 }).toBe(true);
			await expect.poll(() => fulfilled.size, { timeout: 10000 }).toBe(2);
			const raw = (index: number, id: string) =>
				clients[index].fetchById('traces', id, { policy: 'local-only' });
			// Merged JSON maps (revision stamps) keep their own key order per replica: compare by content.
			const sameRows = async (id: string) =>
				canonical(await raw(0, id)) === canonical(await raw(1, id));
			const disconnectSecond = async () => {
				await clients[1].disconnect();
				await expect.poll(() => clients[1].connectionStatus, { timeout: 10000 }).toBe('CLOSED');
			};
			const reconnectSecond = async () => {
				await clients[1].connect();
				await expect.poll(open, { timeout: 10000 }).toBe(true);
			};
			const outboxEmpty = (index: number) =>
				expect.poll(() => getPendingChangeCount(clients[index]), { timeout: 10000 }).toBe(0);

			const { kind, kindV } = await first.createTraceKind({
				name: 'Sync codec',
				initialKindV: { dataSchema }
			});
			const draft: TraceDraft = {
				content: 'legacy shape',
				capturedAt: '2026-09-13T08:00:00.000Z',
				timezone: 'UTC',
				aboutKind: 'instant',
				aboutTime: {
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: '2026-09-11',
					end: null
				},
				relation: 'actual',
				kindId: kind.id,
				kindVId: kindV.id,
				data: { note: 'x', count: 1, mood: 'ok', nested: { x: 1, y: 2 } }
			};
			const trace = await first.createTrace(draft);
			for (const [index, client] of clients.entries())
				unsubscribes.push(
					client.onEntitySyncError('traces', trace.id, (error) => {
						errors.push(`${index}:entity:${String(error)}`);
					})
				);
			await expect
				.poll(async () => (await raw(1, trace.id)) != null, { timeout: 10000 })
				.toBe(true);

			// (a) A legacy row rewritten online: exact payload and marker on both replicas after ACK.
			const rewritten = { note: 'x', count: 2, mood: null, nested: { x: 1 } };
			await first.editTrace(trace.id, { data: rewritten });
			await outboxEmpty(0);
			await expect
				.poll(async () => JSON.stringify((await raw(1, trace.id))?.data), { timeout: 10000 })
				.toBe(JSON.stringify([rewritten]));
			await expect.poll(() => sameRows(trace.id), { timeout: 10000 }).toBe(true);
			expect((await raw(0, trace.id))?.encoding).toEqual({ data: 1 });
			expect((await second.getTrace(trace.id))?.data).toEqual(rewritten);

			// (b) Apart: first clears the date, second changes content and data; all three survive.
			await disconnectSecond();
			await first.editTrace(trace.id, { aboutTime: { basis: 'unknown' } });
			await outboxEmpty(0);
			await second.editTrace(trace.id, { content: 'second content' });
			const secondData = { note: 'y', count: 3, mood: null };
			await second.editTrace(trace.id, { data: secondData });
			await reconnectSecond();
			await outboxEmpty(1);
			await expect
				.poll(async () => (await raw(0, trace.id))?.content, { timeout: 10000 })
				.toBe('second content');
			await expect.poll(() => sameRows(trace.id), { timeout: 10000 }).toBe(true);
			for (const repository of [first, second]) {
				expect(await repository.getTrace(trace.id)).toMatchObject({
					content: 'second content',
					aboutTime: { basis: 'unknown' },
					data: secondData
				});
			}
			expect((await raw(1, trace.id))?.encoding).toEqual({ data: 1, aboutTime: 1 });

			// (c) Same field rewritten apart: the later whole value wins on both, never a hybrid.
			await disconnectSecond();
			await first.editTrace(trace.id, { data: { note: 'A', only: 'a' } });
			await outboxEmpty(0);
			await second.editTrace(trace.id, { data: { note: 'B', other: 'b' } });
			await reconnectSecond();
			await outboxEmpty(1);
			await expect
				.poll(async () => (await second.getTrace(trace.id))?.data?.note, { timeout: 10000 })
				.toBe('B');
			await expect.poll(() => sameRows(trace.id), { timeout: 10000 }).toBe(true);
			for (const repository of [first, second]) {
				expect((await repository.getTrace(trace.id))?.data).toEqual({ note: 'B', other: 'b' });
			}
			expect(errors).toEqual([]);
		} finally {
			for (const unsubscribe of unsubscribes) unsubscribe();
			for (const client of clients) await client.disconnect();
		}
	},
	60000
);
