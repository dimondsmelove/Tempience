import { TriplitClient } from '@triplit/client';
import { expect } from 'vitest';
import { createTriplitRepository, type TempienceRepository } from './repository';
import { schema } from './schema';
import { getPendingChangeCount } from './sync-status';

/** Opt-in: set TEMPIENCE_TEST_SYNC_URL to the isolated loopback server (see sync-server.log). */
export const SYNC_URL = process.env.TEMPIENCE_TEST_SYNC_URL;

export type SyncCollection = keyof typeof schema;

export type SyncReplica = {
	client: TriplitClient<typeof schema>;
	repository: TempienceRepository;
};

export type SyncFixture = {
	replicas: SyncReplica[];
	errors: string[];
	/** A stored row as this replica holds it locally, without asking the server. */
	raw: (
		index: number,
		collection: SyncCollection,
		id: string
	) => Promise<Record<string, unknown> | undefined>;
	has: (index: number, collection: SyncCollection, id: string) => Promise<boolean>;
	/** Every local write of the replica has been acknowledged by the server. */
	acked: (index: number) => Promise<void>;
	open: () => boolean;
	dispose: () => Promise<void>;
};

/** Replicas store merged JSON maps in their own key order; compare values, not key order. */
export const canonical = (value: unknown): string =>
	JSON.stringify(value, (_key, entry: unknown) =>
		entry !== null && typeof entry === 'object' && !Array.isArray(entry)
			? Object.fromEntries(
					Object.entries(entry as Record<string, unknown>).toSorted(([a], [b]) => (a < b ? -1 : 1))
				)
			: entry
	);

const pair = async (url: URL): Promise<string> => {
	const response = await fetch(new URL('/pair', url), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ code: 'tempience-34-isolated-test-code', deviceId: crypto.randomUUID() })
	});
	if (!response.ok) throw new Error(`Pairing failed: ${response.status}`);
	return (await response.json()).token as string;
};

/** Paired, connected replicas subscribed to the collections, with the isolated project checked. */
export const openSyncFixture = async (
	collections: readonly SyncCollection[],
	count = 2
): Promise<SyncFixture> => {
	const url = new URL(SYNC_URL!);
	if (!['127.0.0.1', 'localhost'].includes(url.hostname))
		throw new Error('This probe requires an isolated loopback sync server.');
	const health = await fetch(new URL('/healthz', url)).then((response) => response.json());
	if (health.projectId !== 'tempience-34-synthetic') throw new Error('Unexpected sync project.');
	const replicas: SyncReplica[] = [];
	const unsubscribes: (() => void)[] = [];
	const errors: string[] = [];
	const fulfilled = new Set<string>();
	for (let index = 0; index < count; index++) {
		const client = new TriplitClient({
			schema,
			storage: { type: 'memory' },
			serverUrl: SYNC_URL,
			token: await pair(url),
			autoConnect: true
		});
		replicas.push({ client, repository: createTriplitRepository(client) });
		await client.ready;
		for (const collection of collections)
			unsubscribes.push(
				client.subscribe(
					client.query(collection) as never,
					() => {},
					(error) => {
						errors.push(`${index}:${collection}:${String(error)}`);
					},
					{
						onRemoteFulfilled: () => {
							fulfilled.add(`${index}:${collection}`);
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
	const open = () => replicas.every(({ client }) => client.connectionStatus === 'OPEN');
	await expect.poll(open, { timeout: 10000 }).toBe(true);
	await expect.poll(() => fulfilled.size, { timeout: 10000 }).toBe(collections.length * count);
	const raw = async (index: number, collection: SyncCollection, id: string) =>
		(
			(await replicas[index].client.fetch(replicas[index].client.query(collection) as never, {
				policy: 'local-only'
			})) as Record<string, unknown>[]
		).find((row) => row.id === id);
	return {
		replicas,
		errors,
		raw,
		has: async (index, collection, id) => (await raw(index, collection, id)) !== undefined,
		acked: async (index) => {
			await expect
				.poll(() => getPendingChangeCount(replicas[index].client), { timeout: 10000 })
				.toBe(0);
		},
		open,
		dispose: async () => {
			for (const unsubscribe of unsubscribes) unsubscribe();
			for (const { client } of replicas) await client.disconnect();
		}
	};
};
