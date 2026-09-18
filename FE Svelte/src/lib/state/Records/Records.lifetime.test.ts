import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factFor, intentionOf } from '$lib/state/TraceDraft/results.fixture';
import {
	flush,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { Log } from '$lib/state/triplit/types';
import { controlled } from './Records.fixture';
import { RecordsReader } from './Records.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

const rowsOf = (id: string): Log[] => [{ id }] as unknown as Log[];

describe('what the record reader opens and what it ends', () => {
	it('shows the record when following starts before the read it was asked for lands', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		// What every Context does: ask for the record, then follow it, without awaiting between.
		void reader.load(plan.id);
		const stop = reader.watch();
		await flush();
		expect(reader.result?.traceId).toBe(plan.id);
		expect(counts.journals).toBe(1);
		stop();
		expect([counts.stopped, counts.journalStops]).toEqual([counts.started, 1]);
	});

	it('opens nothing for a read that lands after it was stopped', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository, hold, release } = controlled(fx);
		const reader = new RecordsReader(repository);
		hold();
		const reading = reader.load(plan.id);
		const stop = reader.watch();
		await flush();
		// The Context is left while the record is still being read.
		stop();
		release();
		await reading;
		expect(reader.result).toBeNull();
		// A journal query opened now would follow a record no one is shown and never be ended.
		expect(counts.journals).toBe(0);
		expect(counts.stopped).toBe(3);
	});

	it('keeps a delivery that arrived while a read was in flight, over the read', async () => {
		const plan = await intentionOf(fx, 'План');
		const { repository, hold, release, deliver } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		const stop = reader.watch();
		// A read starts; while it waits, a statement is made and the feeds deliver it.
		hold();
		const reading = reader.reload();
		await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		await deliver('links');
		await deliver('assessments');
		await deliver('others');
		await flush();
		expect(reader.result?.result?.outcome).toBe('completed');
		// The read lands with what it read before the statement; the delivered rows stand.
		release();
		await reading;
		expect(reader.result?.result?.outcome).toBe('completed');
		stop();
	});

	it('lets stopped feeds and a stopped journal answer for nothing, and reopen nothing', async () => {
		const plan = await intentionOf(fx, 'План');
		const { feeds, journal, counts, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		const stop = reader.watch();
		journal[0].next(rowsOf('log-1'));
		const shown = reader.result;
		stop();
		// Callbacks of the ended subscriptions arrive late, as they may: nothing changes.
		for (const feed of feeds) feed.next([]);
		feeds[0].fail(new Error('Подписка недоступна.'));
		journal[0].next(rowsOf('late'));
		journal[0].fail(new Error('Журнал недоступен.'));
		await flush();
		expect(reader.result).toBe(shown);
		expect(reader.logs).toEqual(rowsOf('log-1'));
		expect(reader.error).toBe('');
		expect([counts.journals, counts.journalStops]).toEqual([1, 1]);
	});

	it('treats a read after a stop as the explicit ask it is, ended by the next stop', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		reader.stopWatching();
		expect([counts.journals, counts.journalStops]).toEqual([1, 1]);
		// A caller that reads again means it: the record is shown and its journal followed…
		await reader.reload();
		expect(reader.result?.traceId).toBe(plan.id);
		expect([counts.journals, counts.journalStops]).toEqual([2, 1]);
		// …while the collections are not followed by that; only `watch()` opens the feeds.
		expect(counts.started).toBe(0);
		reader.stopWatching();
		expect([counts.journals, counts.journalStops]).toEqual([2, 2]);
	});

	it('lets a journal query that was replaced answer for nothing', async () => {
		const plan = await intentionOf(fx, 'План');
		const { journal, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		journal[0].next(rowsOf('log-1'));
		expect(reader.logs).toEqual(rowsOf('log-1'));
		// A statement joins this record's history, so the query names other records now.
		await factFor(fx, 'Факт', plan.id, { outcome: 'partial' });
		await reader.reload();
		expect(journal).toHaveLength(2);
		expect(journal[0].stopped).toBe(true);
		journal[1].next(rowsOf('log-2'));
		journal[0].next(rowsOf('stale'));
		journal[0].fail(new Error('Журнал недоступен.'));
		// The replaced query speaks for a record that is not the one being shown.
		expect(reader.logs).toEqual(rowsOf('log-2'));
		expect(reader.error).toBe('');
		reader.stopWatching();
	});

	it('opens the journal again after a refused one, instead of staying silent', async () => {
		const plan = await intentionOf(fx, 'План');
		const { journal, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		journal[0].fail(new Error('Журнал недоступен.'));
		expect(reader.error).toBe('Непредвиденная ошибка: Журнал недоступен.');
		// Reading the record again opens its journal again, although its ids did not change.
		await reader.reload();
		expect(journal).toHaveLength(2);
		expect(journal[1].ids).toEqual(journal[0].ids);
		journal[1].next(rowsOf('log-1'));
		expect([reader.logs, reader.error]).toEqual([rowsOf('log-1'), '']);
		reader.stopWatching();
	});

	it('leaves nothing open after the selection changed several times', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const { counts, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		for (const id of [plan.id, fact.trace.id, plan.id]) {
			void reader.load(id);
			const stop = reader.watch();
			await flush();
			stop();
		}
		// One read per selection, and every subscription and journal query ended exactly once:
		// three feeds and the neighbours' query per selection.
		expect(counts.reads).toBe(3);
		expect([counts.started, counts.stopped]).toEqual([12, 12]);
		expect([counts.journals, counts.journalStops]).toEqual([3, 3]);
	});
});
