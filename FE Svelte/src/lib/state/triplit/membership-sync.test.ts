import { TriplitClient } from '@triplit/client';
import { expect, it } from 'vitest';
import { createTriplitRepository } from './repository';
import { schema } from './schema';

const serverUrl = process.env.TEMPIENCE_TEST_SYNC_URL;

it.runIf(serverUrl)(
	'syncs independent Kind memberships, explicit removal and restore across two clients',
	async () => {
		const url = new URL(serverUrl!);
		if (!['127.0.0.1', 'localhost'].includes(url.hostname))
			throw new Error('This probe requires an isolated loopback sync server.');
		const health = await fetch(new URL('/healthz', url)).then((response) => response.json());
		if (health.projectId !== 'tempience-34-synthetic') throw new Error('Unexpected sync project.');
		const clients: TriplitClient<typeof schema>[] = [];
		const unsubscribes: (() => void)[] = [];
		const subscriptionErrors: unknown[] = [];
		try {
			for (let i = 0; i < 2; i++) {
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
				for (const collection of [
					'traceKinds',
					'traceKindVersions',
					'scopes',
					'intersections'
				] as const)
					unsubscribes.push(
						client.subscribe(
							client.query(collection) as never,
							() => {},
							(error) => {
								subscriptionErrors.push(error);
							}
						)
					);
			}
			const [first, second] = clients.map(createTriplitRepository);
			await expect
				.poll(() => clients.every((client) => client.connectionStatus === 'OPEN'), {
					timeout: 10000
				})
				.toBe(true);
			const { kind } = await first.createTraceKind({
				name: 'Sync test',
				initialKindV: { dataSchema: { type: 'object', properties: {} } }
			});
			const a = await first.createScope({ name: 'Sync A' });
			const b = await first.createScope({ name: 'Sync B' });
			await first.setTraceKindScopes(kind.id, [a.id]);
			const ids = async (index: number) =>
				(
					await clients[index].fetch(clients[index].query('intersections'), {
						policy: 'local-only'
					})
				)
					.filter((row) => row.fromId === kind.id && !row.isDeleted)
					.map((row) => row.toId)
					.sort();
			await expect.poll(() => ids(1), { timeout: 10000 }).toEqual([a.id]);
			await expect
				.poll(async () => (await second.listScopes()).some((scope) => scope.id === b.id), {
					timeout: 10000
				})
				.toBe(true);
			// Independent offline edits must not replace the complete membership set.
			await clients[1].disconnect();
			await first.setScopeDeleted(a.id, true);
			await second.setTraceKindScopes(kind.id, [a.id, b.id]);
			await clients[1].connect();
			await expect.poll(() => ids(0), { timeout: 10000 }).toEqual([b.id]);
			await expect.poll(() => ids(1), { timeout: 10000 }).toEqual([b.id]);
			await first.setScopeDeleted(a.id, false);
			await expect.poll(() => ids(1), { timeout: 10000 }).toEqual([a.id, b.id].sort());
			await first.setScopeDeleted(a.id, true);
			await expect.poll(() => ids(1), { timeout: 10000 }).toEqual([b.id]);
			await second.setTraceKindScopes(kind.id, []);
			await expect.poll(() => ids(0), { timeout: 10000 }).toEqual([]);
			await expect
				.poll(
					async () =>
						(await first.listIntersections(true)).find(
							(row) => row.fromId === kind.id && row.toId === a.id
						)?.scopeDeletionOperationId,
					{ timeout: 10000 }
				)
				.toBeNull();
			await first.setScopeDeleted(a.id, false);
			await expect
				.poll(async () => (await second.listScopes()).some((scope) => scope.id === a.id), {
					timeout: 10000
				})
				.toBe(true);
			expect(await ids(0)).toEqual([]);
			expect(await ids(1)).toEqual([]);
			expect(subscriptionErrors).toEqual([]);
		} finally {
			for (const unsubscribe of unsubscribes) unsubscribe();
			for (const client of clients) await client.disconnect();
		}
	},
	45000
);
