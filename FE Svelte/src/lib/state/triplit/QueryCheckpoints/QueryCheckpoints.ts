import {
	APPLY_POLL_ATTEMPTS,
	APPLY_POLL_MS,
	CHECKPOINT_START,
	QUERY_CHECKPOINTS_KEY,
	QUERY_CHECKPOINTS_LIMIT,
	SHARED_CHECKPOINT_KEY
} from './constants';
import type {
	CheckpointClient,
	ConnectQueryMessage,
	EntityDataMessage,
	QueryCheckpoints,
	SyncMessage,
	Timestamp
} from './types';

const isTimestamp = (value: unknown): value is Timestamp =>
	Array.isArray(value) &&
	value.length === 3 &&
	typeof value[0] === 'number' &&
	typeof value[1] === 'number' &&
	typeof value[2] === 'string';

/** Triplit's own order of its clock values. */
const compare = (a: Timestamp, b: Timestamp): number =>
	a[0] !== b[0] ? a[0] - b[0] : a[1] !== b[1] ? a[1] - b[1] : a[2].localeCompare(b[2]);

const isConnectQuery = (message: SyncMessage): message is ConnectQueryMessage =>
	message.type === 'CONNECT_QUERY';

const isEntityData = (message: SyncMessage): message is EntityDataMessage =>
	message.type === 'ENTITY_DATA';

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * A checkpoint per query instead of Triplit's one shared checkpoint (owner decision 2026-09-20).
 *
 * The installed client (1.0.50) remembers one `latest_server_timestamp`, moved by every answer of
 * the server to any query, and connects every query with it: «send what changed after this». The
 * server then skips every row the client holds whose last change is older. A query connected for
 * the first time on a device — a collection newly subscribed after an update, a query opened later
 * than the others — so never receives the changes other devices made before the shared checkpoint
 * moved past them: a Scope deleted on the phone stayed on the laptop. Here each query connects from
 * its own checkpoint, the timestamp of the server's last answer to it on this device. A query
 * without one connects from the start of time, and the server sends its whole result, reconciling
 * the rows the client lists. The rows listed stay as Triplit computed them.
 *
 * Two seams of the engine, both stable in the pinned version: `sendMessage`, through which every
 * outgoing message passes (private in the typings, an ordinary method at runtime), and
 * `onSyncMessageReceived`, which hears an answer before the engine applies it. A checkpoint is
 * recorded only once the engine has applied the answer, which it shows by moving its shared
 * checkpoint up to the answer's timestamp: that is watched rather than hooked, because the client's
 * `db` is created after the client and replaced when the token changes.
 */
export const installQueryCheckpoints = (target: {
	ready: Promise<unknown>;
	syncEngine: object;
	db: object;
}): QueryCheckpoints => {
	const client = target as unknown as CheckpointClient;
	const engine = client.syncEngine;
	const checkpoints = new Map<string, Timestamp>();
	/** Answers heard and not yet seen applied, in the order they arrived. */
	const arriving: EntityDataMessage['payload'][] = [];
	let closed = false;

	const send = engine.sendMessage.bind(engine);
	engine.sendMessage = (message) => {
		if (!isConnectQuery(message) || !message.payload.state) return send(message);
		const timestamp = checkpoints.get(message.payload.id) ?? CHECKPOINT_START;
		return send({
			...message,
			payload: { ...message.payload, state: { ...message.payload.state, timestamp } }
		});
	};

	const ready = (async (): Promise<void> => {
		await client.ready;
		const stored = await client.db.getMetadata([QUERY_CHECKPOINTS_KEY]);
		if (!stored || typeof stored !== 'object') return;
		for (const [id, timestamp] of Object.entries(stored)) {
			const known = checkpoints.get(id);
			if (isTimestamp(timestamp) && (!known || compare(timestamp, known) > 0))
				checkpoints.set(id, timestamp);
		}
	})();

	const persist = async (): Promise<void> => {
		if (checkpoints.size > QUERY_CHECKPOINTS_LIMIT) {
			const oldestFirst = [...checkpoints].sort(([, a], [, b]) => compare(a, b));
			for (const [id] of oldestFirst.slice(0, checkpoints.size - QUERY_CHECKPOINTS_LIMIT))
				checkpoints.delete(id);
		}
		await client.db.setMetadata([QUERY_CHECKPOINTS_KEY], Object.fromEntries(checkpoints));
	};

	/** Whether the engine has applied the answers up to a timestamp: its shared checkpoint says so. */
	const applied = async (timestamp: Timestamp): Promise<boolean> => {
		for (let attempt = 0; attempt < APPLY_POLL_ATTEMPTS && !closed; attempt++) {
			const shared = await client.db.getMetadata([SHARED_CHECKPOINT_KEY]);
			if (isTimestamp(shared) && compare(shared, timestamp) >= 0) return true;
			await pause(APPLY_POLL_MS);
		}
		return false;
	};

	let settling = false;
	/** Records the answers as the engine applies them, one after the other, in arrival order. */
	const settle = async (): Promise<void> => {
		if (settling) return;
		settling = true;
		try {
			await ready;
			while (arriving.length > 0 && !closed) {
				const answer = arriving[0];
				const done = await applied(answer.timestamp);
				arriving.shift();
				if (!done) continue;
				for (const id of answer.forQueries) checkpoints.set(id, answer.timestamp);
				await persist();
			}
		} finally {
			settling = false;
		}
	};

	const stopReceiving = engine.onSyncMessageReceived((message) => {
		if (!isEntityData(message)) return;
		arriving.push(message.payload);
		void settle();
	});

	return {
		ready,
		of: (queryId) => checkpoints.get(queryId),
		close: () => {
			closed = true;
			stopReceiving();
			engine.sendMessage = send;
		}
	};
};
