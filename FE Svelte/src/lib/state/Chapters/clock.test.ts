import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chapters, tree } from '$lib/model/Chapters/Chapters.fixture';
import { ms } from '$lib/model/Chapters';
import type { Chapter } from '$lib/model/Chapters/types';
import { SelectionState } from '$lib/state/Selection/Selection.svelte';
import { ChaptersState } from './Chapters.svelte';
import type { ChapterWriter } from './types';

/** A store whose feed answers at once with `list`, and whose document the test can hide and show. */
const connected = (list: readonly Chapter[]) => {
	const store = new ChaptersState(() => ({ ...tree }), new SelectionState());
	const writer = {
		subscribeChapters: (next: (rows: Chapter[]) => void) => {
			next([...list]);
			return () => {};
		}
	} as unknown as ChapterWriter;
	return { store, disconnect: store.connect(writer) };
};

describe('«сейчас» of the chapters', () => {
	const listeners = new Set<() => void>();
	const document = {
		visibilityState: 'visible',
		addEventListener: (_: string, listener: () => void) => listeners.add(listener),
		removeEventListener: (_: string, listener: () => void) => listeners.delete(listener)
	};
	beforeEach(() => {
		vi.useFakeTimers();
		vi.stubGlobal('document', document);
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		listeners.clear();
	});

	it('switches the current chapter and stage at their boundary, by one timer, without a reload', () => {
		vi.setSystemTime(ms('2026-09-07T23:59:00+02:00'));
		const { store, disconnect } = connected(chapters);
		expect(store.current?.id).toBe('system');
		expect(store.driver?.stage?.id).toBe('open');
		expect(vi.getTimerCount()).toBe(1);
		vi.advanceTimersByTime(60_000);
		expect(store.driver?.stage?.id).toBe('push');
		expect(vi.getTimerCount()).toBe(1);
		vi.setSystemTime(ms('2026-09-27T23:59:30+02:00'));
		store.tick();
		vi.advanceTimersByTime(30_000);
		expect(store.current?.id).toBe('out');
		// Nothing lies ahead of the last, open chapter: no timer is left running.
		expect(vi.getTimerCount()).toBe(0);
		disconnect();
	});

	it('catches up when the tab is shown again after sleeping past a boundary', () => {
		vi.setSystemTime(ms('2026-09-27T12:00:00+02:00'));
		const { store, disconnect } = connected(chapters);
		expect(store.current?.id).toBe('system');
		// A suspended tab: the clock moves on, the timer did not fire.
		vi.setSystemTime(ms('2026-09-29T08:00:00+02:00'));
		expect(store.current?.id).toBe('system');
		for (const listener of listeners) listener();
		expect(store.current?.id).toBe('out');
		disconnect();
		expect(listeners.size).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it('waits for a boundary farther than a timer can hold in steps', () => {
		vi.setSystemTime(ms('2026-01-01T00:00:00+01:00'));
		const { store, disconnect } = connected(chapters);
		expect(store.current).toBeNull();
		vi.advanceTimersByTime(2_147_483_647);
		expect(store.current).toBeNull();
		expect(vi.getTimerCount()).toBe(1);
		vi.setSystemTime(ms('2026-06-01T00:00:00+02:00') - 1000);
		store.tick();
		vi.advanceTimersByTime(1000);
		expect(store.current?.id).toBe('move');
		disconnect();
	});
});
