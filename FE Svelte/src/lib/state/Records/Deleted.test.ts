import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { intentionOf } from '$lib/state/TraceDraft/results.fixture';
import {
	flush,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { Trace } from '$lib/state/triplit/types';
import { DeletedRecordsReader, type DeletedRecordsRepository } from './Deleted.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

/** The repository with its one query under the test's control, and its read holdable. */
const controlled = () => {
	const feeds: { next: (rows: Trace[]) => void; fail: (error: unknown) => void }[] = [];
	const counts = { started: 0, stopped: 0, reads: 0 };
	let holding = false;
	let held: (() => void) | null = null;
	const repository: DeletedRecordsRepository = {
		listTraceHeads: async (request) => {
			counts.reads += 1;
			const rows = await fx.repository.listTraceHeads(request);
			if (holding) {
				await new Promise<void>((resolve) => {
					held = () => resolve();
				});
			}
			return rows;
		},
		listTraceKinds: fx.repository.listTraceKinds,
		listTraceKindVersions: fx.repository.listTraceKindVersions,
		subscribeTraceHeads: (_request, next, fail) => {
			counts.started += 1;
			feeds.push({ next, fail });
			return () => {
				counts.stopped += 1;
			};
		}
	};
	const deliver = async () =>
		feeds.at(-1)!.next(await fx.repository.listTraceHeads({ deleted: 'deleted', summaries: [] }));
	return {
		feeds,
		counts,
		repository,
		deliver,
		hold: () => {
			holding = true;
		},
		release: () => {
			holding = false;
			held?.();
			held = null;
		}
	};
};

describe('the list of deleted records and the replica', () => {
	it('shows what it read when following starts before the read lands', async () => {
		const plan = await intentionOf(fx, 'План');
		await fx.repository.setTraceDeleted(plan.id, true, 'user');
		const { counts, repository } = controlled();
		const deleted = new DeletedRecordsReader(repository);
		// What the Context does when the list is opened: ask for it, then follow it. The query
		// opens once the read has brought the summary leaves it needs.
		void deleted.load();
		const stop = deleted.watch();
		await flush();
		expect(deleted.records.map((record) => record.trace.id)).toEqual([plan.id]);
		expect(counts.started).toBe(1);
		stop();
		expect(counts.stopped).toBe(1);
	});

	it('shows what the query delivers, its first answer included, and reads nothing for it', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository, deliver } = controlled();
		const deleted = new DeletedRecordsReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		const reads = counts.reads;
		await fx.repository.setTraceDeleted(plan.id, true, 'user');
		await deliver();
		await flush();
		expect(counts.reads).toBe(reads);
		expect(deleted.records.map((record) => record.trace.id)).toEqual([plan.id]);
		await fx.repository.setTraceDeleted(plan.id, false, 'user');
		await deliver();
		await flush();
		expect(deleted.records).toEqual([]);
		stop();
	});

	it('keeps a delivery that arrived while a read was in flight, over the read', async () => {
		const plan = await intentionOf(fx, 'План');
		const { repository, hold, release, deliver } = controlled();
		const deleted = new DeletedRecordsReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		hold();
		const reading = deleted.load();
		await fx.repository.setTraceDeleted(plan.id, true, 'user');
		await deliver();
		await flush();
		expect(deleted.records.map((record) => record.trace.id)).toEqual([plan.id]);
		release();
		await reading;
		expect(deleted.records.map((record) => record.trace.id)).toEqual([plan.id]);
		stop();
	});

	it('answers a refused subscription where it happened, keeping what it read', async () => {
		const plan = await intentionOf(fx, 'План');
		await fx.repository.setTraceDeleted(plan.id, true, 'user');
		const { feeds, repository } = controlled();
		const deleted = new DeletedRecordsReader(repository);
		await deleted.load();
		deleted.watch();
		feeds[0].fail(new Error('Подписка недоступна.'));
		expect(deleted.error).toBe('Непредвиденная ошибка: Подписка недоступна.');
		expect(deleted.records).toHaveLength(1);
		deleted.stopWatching();
		// A late answer of the ended subscription changes nothing.
		feeds[0].next([]);
		expect(deleted.records).toHaveLength(1);
	});
});
