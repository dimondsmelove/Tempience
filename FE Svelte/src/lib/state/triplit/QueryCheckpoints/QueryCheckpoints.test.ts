import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installQueryCheckpoints } from './QueryCheckpoints';
import {
	APPLY_POLL_ATTEMPTS,
	APPLY_POLL_MS,
	CHECKPOINT_START,
	QUERY_CHECKPOINTS_KEY,
	QUERY_CHECKPOINTS_LIMIT,
	SHARED_CHECKPOINT_KEY
} from './constants';
import type { ConnectQueryMessage, QueryState, SyncMessage, Timestamp } from './types';

const at = (ms: number): Timestamp => [ms, 0, 'server'];
const rows: QueryState['entityIds'] = { scopes: ['a', 'b'] };

type Options = Readonly<{
	/** The client's `db` is there only once the client is ready, as Triplit's is. */
	dbLater?: boolean;
	/** The stored checkpoints take their time to be read. */
	loadLater?: boolean;
}>;

/** An engine and a store behaving as Triplit's do at the two seams; the test plays the server and the engine. */
const fakeClient = (metadata = new Map<string, unknown>(), options: Options = {}) => {
	const sent: SyncMessage[] = [];
	const listeners = new Set<(message: SyncMessage) => void>();
	let releaseReady = (): void => {};
	let releaseLoad = (): void => {};
	const ready = options.dbLater
		? new Promise<void>((resolve) => (releaseReady = resolve))
		: Promise.resolve();
	const loaded = new Promise<void>((resolve) => (releaseLoad = resolve));
	let dbThere = !options.dbLater;
	const engine = {
		sendMessage: (message: SyncMessage) => {
			sent.push(message);
			return true;
		},
		onSyncMessageReceived: (callback: (message: SyncMessage) => void) => {
			listeners.add(callback);
			return () => {
				listeners.delete(callback);
			};
		}
	};
	const db = {
		getMetadata: async (key: string[]) => {
			if (options.loadLater && key[0] === QUERY_CHECKPOINTS_KEY) await loaded;
			return metadata.get(key.join('/'));
		},
		setMetadata: async (key: string[], value: unknown) => {
			metadata.set(key.join('/'), value);
		}
	};
	const client = {
		ready,
		syncEngine: engine,
		get db() {
			return dbThere ? db : undefined;
		}
	} as unknown as { ready: Promise<unknown>; syncEngine: object; db: object };
	/** The engine hears an answer of the server for some queries. */
	const heard = (timestamp: Timestamp, forQueries: string[]): void => {
		for (const listener of listeners)
			listener({ type: 'ENTITY_DATA', payload: { timestamp, forQueries, changes: {} } });
	};
	/** The engine has applied the answers up to a timestamp: it moved its shared checkpoint. */
	const applied = async (timestamp: Timestamp): Promise<void> => {
		metadata.set(SHARED_CHECKPOINT_KEY, timestamp);
		await vi.advanceTimersByTimeAsync(APPLY_POLL_MS * 2);
	};
	return {
		client,
		engine,
		sent,
		metadata,
		clientReady: async () => {
			dbThere = true;
			releaseReady();
			await vi.advanceTimersByTimeAsync(0);
		},
		releaseLoad: () => releaseLoad(),
		heard,
		applied,
		answer: async (timestamp: Timestamp, forQueries: string[]) => {
			heard(timestamp, forQueries);
			await applied(timestamp);
		},
		/** The engine connects a query with the shared checkpoint, as Triplit does. */
		connect: (id: string, shared: Timestamp | undefined) =>
			engine.sendMessage({
				type: 'CONNECT_QUERY',
				payload: {
					id,
					params: { collectionName: 'scopes' },
					...(shared ? { state: { timestamp: shared, entityIds: rows } } : {})
				}
			}),
		stateSent: (index: number) => (sent[index] as ConnectQueryMessage).payload.state
	};
};

describe('query checkpoints', () => {
	beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
	afterEach(() => vi.useRealTimers());

	it('a query the server has not answered on this device connects from the start of time, its rows listed', async () => {
		const fx = fakeClient();
		await installQueryCheckpoints(fx.client).ready;
		fx.connect('q1', at(2000));
		expect(fx.stateSent(0)).toEqual({ timestamp: CHECKPOINT_START, entityIds: rows });
	});

	it('a query connects from the server’s last answer to it, not from the shared checkpoint', async () => {
		const fx = fakeClient();
		await installQueryCheckpoints(fx.client).ready;
		await fx.answer(at(1000), ['q1']);
		fx.connect('q1', at(2000));
		fx.connect('q2', at(2000));
		expect(fx.stateSent(0)?.timestamp).toEqual(at(1000));
		expect(fx.stateSent(1)?.timestamp).toEqual(CHECKPOINT_START);
	});

	it('a connection without state and every other message pass as they are', async () => {
		const fx = fakeClient();
		await installQueryCheckpoints(fx.client).ready;
		fx.connect('q1', undefined);
		const changes: SyncMessage = { type: 'CHANGES', payload: {} };
		fx.engine.sendMessage(changes);
		expect(fx.stateSent(0)).toBeUndefined();
		expect(fx.sent[1]).toBe(changes);
	});

	it('a checkpoint is recorded once the engine has applied the answer, not when it is heard', async () => {
		const fx = fakeClient();
		const checkpoints = installQueryCheckpoints(fx.client);
		await checkpoints.ready;
		fx.heard(at(1000), ['q1']);
		await vi.advanceTimersByTimeAsync(APPLY_POLL_MS * 3);
		expect(checkpoints.of('q1')).toBeUndefined();
		expect(fx.metadata.has(QUERY_CHECKPOINTS_KEY)).toBe(false);
		await fx.applied(at(1000));
		expect(checkpoints.of('q1')).toEqual(at(1000));
		expect(fx.metadata.get(QUERY_CHECKPOINTS_KEY)).toEqual({ q1: at(1000) });
	});

	it('answers settle in arrival order: a shared checkpoint moved past several settles them all', async () => {
		const fx = fakeClient();
		const checkpoints = installQueryCheckpoints(fx.client);
		await checkpoints.ready;
		fx.heard(at(1000), ['q1']);
		fx.heard(at(1000), ['q2']);
		fx.heard(at(3000), ['q3']);
		await fx.applied(at(2000));
		expect(checkpoints.of('q1')).toEqual(at(1000));
		expect(checkpoints.of('q2')).toEqual(at(1000));
		expect(checkpoints.of('q3')).toBeUndefined();
		await fx.applied(at(3000));
		expect(checkpoints.of('q3')).toEqual(at(3000));
	});

	it('an answer the engine never applies is not recorded; the next one is', async () => {
		const fx = fakeClient();
		const checkpoints = installQueryCheckpoints(fx.client);
		await checkpoints.ready;
		fx.heard(at(1000), ['q1']);
		await vi.advanceTimersByTimeAsync(APPLY_POLL_MS * (APPLY_POLL_ATTEMPTS + 1));
		expect(checkpoints.of('q1')).toBeUndefined();
		await fx.answer(at(2000), ['q2']);
		expect(checkpoints.of('q1')).toBeUndefined();
		expect(checkpoints.of('q2')).toEqual(at(2000));
	});

	it('the store is reached only once the client is ready: Triplit creates it then', async () => {
		const fx = fakeClient(new Map(), { dbLater: true });
		const checkpoints = installQueryCheckpoints(fx.client);
		fx.connect('q1', at(5000));
		expect(fx.stateSent(0)?.timestamp).toEqual(CHECKPOINT_START);
		fx.heard(at(1000), ['q1']);
		await vi.advanceTimersByTimeAsync(APPLY_POLL_MS * 3);
		expect(checkpoints.of('q1')).toBeUndefined();
		await fx.clientReady();
		await checkpoints.ready;
		await fx.applied(at(1000));
		expect(checkpoints.of('q1')).toEqual(at(1000));
	});

	it('the checkpoints survive a restart: read from the store on install', async () => {
		const first = fakeClient();
		await installQueryCheckpoints(first.client).ready;
		await first.answer(at(1000), ['q1']);
		const second = fakeClient(first.metadata);
		await installQueryCheckpoints(second.client).ready;
		second.connect('q1', at(5000));
		second.connect('q2', at(5000));
		expect(second.stateSent(0)?.timestamp).toEqual(at(1000));
		expect(second.stateSent(1)?.timestamp).toEqual(CHECKPOINT_START);
	});

	it('until the stored checkpoints are read, a query connects from the start of time', async () => {
		const metadata = new Map<string, unknown>([[QUERY_CHECKPOINTS_KEY, { q1: at(1000) }]]);
		const fx = fakeClient(metadata, { loadLater: true });
		const checkpoints = installQueryCheckpoints(fx.client);
		fx.connect('q1', at(5000));
		expect(fx.stateSent(0)?.timestamp).toEqual(CHECKPOINT_START);
		fx.releaseLoad();
		await checkpoints.ready;
		fx.connect('q1', at(5000));
		expect(fx.stateSent(1)?.timestamp).toEqual(at(1000));
	});

	it('past the limit the oldest checkpoints go', async () => {
		const fx = fakeClient();
		const checkpoints = installQueryCheckpoints(fx.client);
		await checkpoints.ready;
		const old = Array.from({ length: QUERY_CHECKPOINTS_LIMIT }, (_, index) => `old-${index}`);
		await fx.answer(at(1000), old);
		await fx.answer(at(2000), ['new']);
		const stored = fx.metadata.get(QUERY_CHECKPOINTS_KEY) as Record<string, Timestamp>;
		expect(Object.keys(stored)).toHaveLength(QUERY_CHECKPOINTS_LIMIT);
		expect(stored.new).toEqual(at(2000));
		expect(checkpoints.of('old-0')).toBeUndefined();
		expect(checkpoints.of('old-1')).toEqual(at(1000));
	});

	it('close puts the engine back and stops following answers', async () => {
		const fx = fakeClient();
		const checkpoints = installQueryCheckpoints(fx.client);
		await checkpoints.ready;
		checkpoints.close();
		fx.connect('q1', at(2000));
		await fx.answer(at(3000), ['q1']);
		expect(fx.stateSent(0)?.timestamp).toEqual(at(2000));
		expect(checkpoints.of('q1')).toBeUndefined();
	});
});
