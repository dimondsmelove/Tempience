import type { TempienceTriplitClient } from './client';

/**
 * The collections the Time surface's snapshot is built from, read whole at the sync boundary:
 * no `isDeleted` filter here, so a row deleted on another device reaches this store as
 * `isDeleted: true` and the reads above it (which filter after) drop it. A filtered query
 * would have the server evict such a row from the local store instead (Triplit sends a
 * delete for a row that left a query's result set), and the deleted-records list would lose it.
 */
export const INBOUND_COLLECTIONS = [
	'traces',
	'scopes',
	'intersections',
	'periods',
	'intentionAssessments',
	'traceKinds',
	'traceKindVersions',
	'scopeSegments'
] as const;

export type InboundCollection = (typeof INBOUND_COLLECTIONS)[number];

/** How long the first read waits for the server before the ribbon renders from the local store. */
export const INBOUND_PULL_BOUND_MS = 5000;

/** What the feed needs of the client: held background subscriptions and the connection. */
export type InboundClient = Pick<
	TempienceTriplitClient,
	'ready' | 'query' | 'subscribeBackground' | 'connectionStatus' | 'onConnectionStatusChange'
>;

/** One answer of the server for one collection: the rows it sent are in the local store. */
export type InboundDelivery = Readonly<{
	collection: InboundCollection;
	/** When it landed, ISO. */
	at: string;
	/** Part of the first read the loader waited for — not a change that came after it. */
	initial: boolean;
}>;

/** How a pull ended: every collection answered by the server, or the local store as it was. */
export type InboundPullResult = 'server' | 'local';

export type InboundFeed = {
	/** Whether the server is read at all: the space syncs and the client has somewhere to connect. */
	readonly enabled: boolean;
	/** When the server last answered for one of the collections, ISO; null before the first time. */
	readonly lastReadAt: string | null;
	/**
	 * Opens the held subscriptions on the first call and waits, bounded, for the server's
	 * first answer on every collection; a later call answers at once. Offline, or with the
	 * connection closed, nothing is waited for: the subscriptions stay, and what arrives
	 * once the connection opens is delivered as a change.
	 */
	pull(boundMs?: number): Promise<InboundPullResult>;
	/** Every answer of the server, first reads and changes alike. */
	onDelivery(listener: (delivery: InboundDelivery) => void): () => void;
	/** Ends the subscriptions and the listeners (tests, a DataSpace switch reloads the app anyway). */
	close(): void;
};

export type InboundFeedOptions = Readonly<{
	enabled: boolean;
	/** What the subscriptions wait for; the app waits for the storage to run the current schema, since a collection newer than a stored schema cannot be subscribed. */
	ready?: () => Promise<void>;
	now?: () => string;
}>;

/**
 * The inbound half of sync for the Time surface (owner decision 2026-09-20). Triplit's own
 * reads are local-first: a query the client has fetched once is answered from the local store
 * and nothing tells it that another device changed a row since. The feed holds one background
 * subscription per snapshot collection for the life of the client, so the server pushes every
 * later change into the local store, and the subscription's fulfilment — which Triplit
 * signals on every push, not only the first — is the change signal the workbench refreshes on.
 * `subscribeBackground` rather than `fetch(…, { policy: 'remote-first' })`: the installed
 * SDK's `syncQuery` rejects when a matching subscription is already fulfilled, and a one-shot
 * pull would disconnect the query and drop what the server sends after the bound.
 */
export const createInboundFeed = (
	client: InboundClient,
	options: InboundFeedOptions
): InboundFeed => {
	const now = options.now ?? (() => new Date().toISOString());
	const ready = options.ready ?? (() => client.ready);
	const listeners = new Set<(delivery: InboundDelivery) => void>();
	const answered = new Set<InboundCollection>();
	const failed = new Set<InboundCollection>();
	const unsubscribes: (() => void)[] = [];
	let opened: Promise<void> | null = null;
	/** The first pull ended: what the server sends from here on is a change. */
	let settled = false;
	let lastReadAt: string | null = null;
	/** Ends the wait of the first pull, when one is waiting. */
	let complete: ((result: InboundPullResult) => void) | null = null;

	const everyCollectionHeard = (): boolean =>
		answered.size + failed.size >= INBOUND_COLLECTIONS.length;

	const deliver = (collection: InboundCollection): void => {
		const at = now();
		lastReadAt = at;
		answered.add(collection);
		const delivery: InboundDelivery = { collection, at, initial: !settled };
		for (const listener of listeners) listener(delivery);
		if (!settled && answered.size === INBOUND_COLLECTIONS.length) complete?.('server');
	};

	const open = (): Promise<void> =>
		(opened ??= (async () => {
			await ready();
			for (const collection of INBOUND_COLLECTIONS) {
				unsubscribes.push(
					client.subscribeBackground(client.query(collection) as never, {
						onFulfilled: () => deliver(collection),
						onError: (error: unknown) => {
							console.warn(
								'[tempience:inbound] the server refused a collection',
								collection,
								error
							);
							failed.add(collection);
							if (!settled && everyCollectionHeard()) complete?.('local');
						}
					})
				);
			}
		})());

	const outcome = (): InboundPullResult =>
		answered.size === INBOUND_COLLECTIONS.length ? 'server' : 'local';

	/** The wait of the first pull, shared by every pull that overlaps it. */
	let waiting: Promise<InboundPullResult> | null = null;
	const waitForAnswers = (boundMs: number): Promise<InboundPullResult> =>
		(waiting ??= new Promise<InboundPullResult>((resolve) => {
			const timer = setTimeout(() => finish('local'), boundMs);
			let stopStatus = (): void => {};
			const finish = (result: InboundPullResult): void => {
				clearTimeout(timer);
				stopStatus();
				complete = null;
				settled = true;
				resolve(result);
			};
			complete = finish;
			// A closed connection answers nothing until it opens again: the store as it is, now.
			// (A paired client that has not connected yet is about to, and is waited for.)
			stopStatus = client.onConnectionStatusChange((status) => {
				if (status === 'CLOSED') finish('local');
			}, true);
		}));

	const pull = async (boundMs = INBOUND_PULL_BOUND_MS): Promise<InboundPullResult> => {
		if (!options.enabled) return 'local';
		if (settled) return outcome();
		try {
			await open();
		} catch (error: unknown) {
			console.warn('[tempience:inbound] the server is not read', error);
			settled = true;
			return 'local';
		}
		if (settled) return outcome();
		if (answered.size === INBOUND_COLLECTIONS.length) {
			settled = true;
			return 'server';
		}
		return waitForAnswers(boundMs);
	};

	return {
		enabled: options.enabled,
		get lastReadAt() {
			return lastReadAt;
		},
		pull,
		onDelivery: (listener) => {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		close: () => {
			complete?.('local');
			for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
			listeners.clear();
			opened = null;
		}
	};
};
