import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import type { InboundDelivery, InboundFeed } from '$lib/state/triplit/inbound-sync';
import { EMPTY_SNAPSHOT, INBOUND_REFRESH_DEBOUNCE_MS } from './constants';
import { InboundState } from './inbound.svelte';

/** A feed the test plays: every `deliver` is one answer of the server. */
const fakeFeed = () => {
	const listeners = new Set<(delivery: InboundDelivery) => void>();
	let lastReadAt: string | null = null;
	const feed: InboundFeed = {
		enabled: true,
		get lastReadAt() {
			return lastReadAt;
		},
		pull: async () => 'server',
		onDelivery: (listener) => {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		close: () => listeners.clear()
	};
	return {
		feed,
		deliver: (
			collection: InboundDelivery['collection'],
			initial = false,
			at = '2026-09-20T09:00:00.000Z'
		) => {
			lastReadAt = at;
			for (const listener of listeners) listener({ collection, at, initial });
		},
		listeners
	};
};

/** The workbench as the hook sees it: what it is doing, and the reads asked of it. */
const fakeWorkbench = () => {
	const reads: string[] = [];
	const workbench = {
		status: 'ready' as 'idle' | 'loading' | 'ready' | 'error',
		timelineCovered: false,
		stale: false,
		markStale() {
			this.stale = true;
		},
		refresh: async (loader: () => Promise<ExplorerSnapshot>) => {
			reads.push('refresh');
			await loader();
		}
	};
	return { workbench, reads };
};

const loader = async (): Promise<ExplorerSnapshot> => EMPTY_SNAPSHOT;

describe('the inbound state: changes from other devices reach the ribbon', () => {
	beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
	afterEach(() => vi.useRealTimers());

	it('reads the snapshot again in place after the quiet spell: many rows of one change, one read', async () => {
		const fx = fakeFeed();
		const wb = fakeWorkbench();
		const inbound = new InboundState();
		const stop = inbound.follow(fx.feed, {
			workbench: wb.workbench,
			loader,
			deferred: () => false
		});
		fx.deliver('traces', true);
		expect(inbound.lastReadAt).toBe('2026-09-20T09:00:00.000Z');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		// The first read is the loader's own: nothing to read again.
		expect(wb.reads).toEqual([]);
		fx.deliver('scopes', false, '2026-09-20T09:01:00.000Z');
		fx.deliver('intersections', false, '2026-09-20T09:01:00.100Z');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS - 1);
		expect(wb.reads).toEqual([]);
		fx.deliver('traces', false, '2026-09-20T09:01:00.400Z');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS - 1);
		expect(wb.reads).toEqual([]);
		await vi.advanceTimersByTimeAsync(1);
		expect(wb.reads).toEqual(['refresh']);
		expect(inbound.pending).toBe(false);
		expect(inbound.lastReadAt).toBe('2026-09-20T09:01:00.400Z');
		stop();
		expect(fx.listeners.size).toBe(0);
	});

	it('leaves an open form alone: the read waits behind «Обновить», and follows the click', async () => {
		const fx = fakeFeed();
		const wb = fakeWorkbench();
		const inbound = new InboundState();
		let formOpen = true;
		inbound.follow(fx.feed, { workbench: wb.workbench, loader, deferred: () => formOpen });
		fx.deliver('scopes');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual([]);
		expect(inbound.pending).toBe(true);
		// Another change while the notice is up changes nothing.
		fx.deliver('traces');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual([]);
		expect(inbound.pending).toBe(true);
		// «Обновить» with the form still open: the read now, the input to itself.
		inbound.refresh();
		expect(wb.reads).toEqual(['refresh']);
		expect(inbound.pending).toBe(false);
		// The next change, once the form has closed, reads by itself.
		formOpen = false;
		fx.deliver('periods');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual(['refresh', 'refresh']);
	});

	it('follows by itself once the input it waited for ends', async () => {
		const fx = fakeFeed();
		const wb = fakeWorkbench();
		const inbound = new InboundState();
		let formOpen = true;
		inbound.follow(fx.feed, { workbench: wb.workbench, loader, deferred: () => formOpen });
		fx.deliver('scopes');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(inbound.pending).toBe(true);
		formOpen = false;
		// What the workbench's effect does when the form closes with a read owed.
		inbound.schedule();
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual(['refresh']);
		expect(inbound.pending).toBe(false);
	});

	it('marks the timeline stale behind a Kind table, as after this device’s own commits', async () => {
		const fx = fakeFeed();
		const wb = fakeWorkbench();
		wb.workbench.timelineCovered = true;
		const inbound = new InboundState();
		inbound.follow(fx.feed, { workbench: wb.workbench, loader, deferred: () => false });
		fx.deliver('traces');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual([]);
		expect(wb.workbench.stale).toBe(true);
		expect(inbound.pending).toBe(false);
	});

	it('reads after a read in flight, not beside it', async () => {
		const fx = fakeFeed();
		const wb = fakeWorkbench();
		wb.workbench.status = 'loading';
		const inbound = new InboundState();
		inbound.follow(fx.feed, { workbench: wb.workbench, loader, deferred: () => false });
		fx.deliver('traces');
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual([]);
		wb.workbench.status = 'ready';
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual(['refresh']);
	});

	it('reads nothing once the workbench is gone', async () => {
		const fx = fakeFeed();
		const wb = fakeWorkbench();
		const inbound = new InboundState();
		const stop = inbound.follow(fx.feed, {
			workbench: wb.workbench,
			loader,
			deferred: () => false
		});
		fx.deliver('traces');
		stop();
		await vi.advanceTimersByTimeAsync(INBOUND_REFRESH_DEBOUNCE_MS);
		expect(wb.reads).toEqual([]);
		inbound.refresh();
		expect(wb.reads).toEqual([]);
	});
});
