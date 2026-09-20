import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	INBOUND_COLLECTIONS,
	INBOUND_PULL_BOUND_MS,
	createInboundFeed,
	type InboundClient,
	type InboundDelivery
} from './inbound-sync';

type Subscribed = {
	query: { collectionName: string; where?: unknown };
	onFulfilled?: () => void;
	onError?: (error: unknown) => void;
};

/** A client that records its background subscriptions and lets the test play the server. */
const fakeClient = (status: string) => {
	const subscriptions: Subscribed[] = [];
	const unsubscribed: string[] = [];
	const statusListeners = new Set<(status: string) => void>();
	const client = {
		ready: Promise.resolve(),
		query: (collectionName: string) => ({ collectionName }),
		subscribeBackground: (
			query: Subscribed['query'],
			options: Pick<Subscribed, 'onFulfilled' | 'onError'>
		) => {
			subscriptions.push({ query, ...options });
			return () => unsubscribed.push(query.collectionName);
		},
		get connectionStatus() {
			return status;
		},
		onConnectionStatusChange: (listener: (status: string) => void, runImmediately?: boolean) => {
			statusListeners.add(listener);
			if (runImmediately) listener(status);
			return () => statusListeners.delete(listener);
		}
	} as unknown as InboundClient;
	return {
		client,
		subscriptions,
		unsubscribed,
		/** The server answers for a collection: Triplit signals a fulfilment on every push. */
		answer: (collection: string) =>
			subscriptions.find((entry) => entry.query.collectionName === collection)?.onFulfilled?.(),
		answerAll: () => subscriptions.forEach((entry) => entry.onFulfilled?.()),
		setStatus: (next: string) => {
			status = next;
			for (const listener of statusListeners) listener(next);
		}
	};
};

/** Lets the feed's promises settle under the fake timers. */
const flush = () => vi.advanceTimersByTimeAsync(0);

describe('the inbound feed', () => {
	beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
	afterEach(() => vi.useRealTimers());

	it('reads the server on the remote path: every snapshot collection, whole, held, and the pull ends when all have answered', async () => {
		const fx = fakeClient('OPEN');
		const feed = createInboundFeed(fx.client, {
			enabled: true,
			now: () => '2026-09-20T09:00:00.000Z'
		});
		const deliveries: InboundDelivery[] = [];
		feed.onDelivery((delivery) => deliveries.push(delivery));
		let result: string | undefined;
		void feed.pull().then((outcome) => (result = outcome));
		await flush();
		// No `isDeleted` filter at the sync boundary: the rows that became deleted elsewhere must land.
		expect(fx.subscriptions.map((entry) => entry.query.collectionName)).toEqual([
			...INBOUND_COLLECTIONS
		]);
		expect(fx.subscriptions.every((entry) => entry.query.where === undefined)).toBe(true);
		expect(result).toBeUndefined();
		for (const collection of INBOUND_COLLECTIONS.slice(0, -1)) fx.answer(collection);
		await flush();
		expect(result).toBeUndefined();
		fx.answer(INBOUND_COLLECTIONS.at(-1)!);
		await flush();
		expect(result).toBe('server');
		expect(feed.lastReadAt).toBe('2026-09-20T09:00:00.000Z');
		expect(deliveries).toHaveLength(INBOUND_COLLECTIONS.length);
		expect(deliveries.every((delivery) => delivery.initial)).toBe(true);
		// The subscriptions are held: nothing was disconnected once the pull ended.
		expect(fx.unsubscribed).toEqual([]);
		// A later answer is a change from elsewhere.
		fx.answer('scopes');
		expect(deliveries.at(-1)).toMatchObject({ collection: 'scopes', initial: false });
		// A later pull answers at once from what was read.
		await expect(feed.pull()).resolves.toBe('server');
	});

	it('takes the local path without waiting when the connection is closed, and still holds the subscriptions for what comes later', async () => {
		const fx = fakeClient('CLOSED');
		const feed = createInboundFeed(fx.client, { enabled: true });
		const deliveries: InboundDelivery[] = [];
		feed.onDelivery((delivery) => deliveries.push(delivery));
		await expect(feed.pull()).resolves.toBe('local');
		expect(fx.subscriptions).toHaveLength(INBOUND_COLLECTIONS.length);
		// The connection opens and the server answers: not dropped, delivered as changes.
		fx.setStatus('OPEN');
		fx.answerAll();
		expect(deliveries).toHaveLength(INBOUND_COLLECTIONS.length);
		expect(deliveries.every((delivery) => !delivery.initial)).toBe(true);
	});

	it('gives up waiting when the connection closes while it waits, and pulls that overlap share the wait', async () => {
		const fx = fakeClient('UNINITIALIZED');
		const feed = createInboundFeed(fx.client, { enabled: true });
		let result: string | undefined;
		let overlapping: string | undefined;
		void feed.pull().then((outcome) => (result = outcome));
		void feed.pull().then((outcome) => (overlapping = outcome));
		await flush();
		fx.setStatus('CONNECTING');
		await flush();
		expect(result).toBeUndefined();
		fx.setStatus('CLOSED');
		await flush();
		expect(result).toBe('local');
		expect(overlapping).toBe('local');
	});

	it('renders from the local store at the bound and delivers what arrives after as a change', async () => {
		const fx = fakeClient('OPEN');
		const feed = createInboundFeed(fx.client, { enabled: true });
		const deliveries: InboundDelivery[] = [];
		feed.onDelivery((delivery) => deliveries.push(delivery));
		let result: string | undefined;
		void feed.pull().then((outcome) => (result = outcome));
		await flush();
		await vi.advanceTimersByTimeAsync(INBOUND_PULL_BOUND_MS - 1);
		expect(result).toBeUndefined();
		await vi.advanceTimersByTimeAsync(1);
		expect(result).toBe('local');
		fx.answer('traces');
		expect(deliveries).toEqual([expect.objectContaining({ collection: 'traces', initial: false })]);
		expect(feed.lastReadAt).not.toBeNull();
	});

	it('keeps a space that does not sync, and an unpaired browser, off the wire', async () => {
		const fx = fakeClient('OPEN');
		const feed = createInboundFeed(fx.client, { enabled: false });
		await expect(feed.pull()).resolves.toBe('local');
		expect(fx.subscriptions).toEqual([]);
		expect(feed.lastReadAt).toBeNull();
	});

	it('does not wait for a collection the server refused', async () => {
		const fx = fakeClient('OPEN');
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const feed = createInboundFeed(fx.client, { enabled: true });
		let result: string | undefined;
		void feed.pull().then((outcome) => (result = outcome));
		await flush();
		for (const collection of INBOUND_COLLECTIONS.slice(1)) fx.answer(collection);
		fx.subscriptions[0].onError?.(new Error('refused'));
		await flush();
		expect(result).toBe('local');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('ends its subscriptions and listeners on close', async () => {
		const fx = fakeClient('OPEN');
		const feed = createInboundFeed(fx.client, { enabled: true });
		const deliveries: InboundDelivery[] = [];
		feed.onDelivery((delivery) => deliveries.push(delivery));
		void feed.pull();
		await flush();
		feed.close();
		expect(fx.unsubscribed).toEqual([...INBOUND_COLLECTIONS]);
		fx.answerAll();
		expect(deliveries).toEqual([]);
	});
});
