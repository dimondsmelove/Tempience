import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { factFor, intentionOf } from '$lib/state/TraceDraft/results.fixture';
import {
	flush,
	openDraftFixture,
	type DraftFixture
} from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { Log, Trace } from '$lib/state/triplit/types';
import { controlled } from './Records.fixture';
import { RecordsReader } from './Records.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

describe('the record reader and the replica', () => {
	it('follows a record with no neighbours through the real repository, and ends it', async () => {
		const plan = await intentionOf(fx, 'План');
		// The neighbours' query of no ids answers empty; an answer inside the call that opened
		// it made the reader open it again without end (the browser's stack overflowed).
		const reader = new RecordsReader(fx.repository);
		await reader.load(plan.id);
		const stop = reader.watch();
		await flush();
		expect([reader.error, reader.result?.traceId, reader.links]).toEqual(['', plan.id, []]);
		stop();
	});

	it('shows what a feed delivers, and reads nothing for it', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository, deliver } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		expect(reader.result?.result?.outcome).toBeNull();
		const stop = reader.watch();
		// The record, the links touching it, the statements addressed to it, and its neighbours.
		expect(counts.started).toBe(4);
		const reads = counts.reads;
		// A statement arrives — from this device or another one — and the shown state follows
		// from the delivered rows themselves, not from another read of the record.
		await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		await deliver('links');
		await deliver('assessments');
		// The links name a new neighbour, so the neighbours' query was renewed for it.
		await deliver('others');
		await flush();
		expect(reader.result?.result?.outcome).toBe('completed');
		expect(reader.links.map((link) => link.summary?.title)).toEqual(['Факт']);
		expect(counts.reads).toBe(reads);
		stop();
		expect(counts.stopped).toBe(counts.started);
	});

	it('shows a change committed between the read and the first answer of a feed', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository, deliver } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		const stop = reader.watch();
		const reads = counts.reads;
		// The change lands after the read and before the subscriptions have answered at all.
		await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		// The first answer of each feed is the current state, and it is the only delivery.
		await deliver('record');
		await deliver('links');
		await deliver('assessments');
		await deliver('others');
		await flush();
		expect(reader.result?.result?.outcome).toBe('completed');
		expect(reader.links.map((link) => link.summary?.title)).toEqual(['Факт']);
		expect(counts.reads).toBe(reads);
		stop();
	});

	it('subscribes to the journal of this record only, and follows what it names', async () => {
		const plan = await intentionOf(fx, 'План');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const { journal, counts, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		expect(counts.journals).toBe(1);
		const ids = journal[0].ids;
		// The record, the link that names it and the statement made through that link.
		expect(ids).toContain(plan.id);
		expect(ids).toContain(fact.links[0].id);
		expect(ids).toContain(fact.assessments[0].id);
		// Nothing else of the space is subscribed to: the fact itself is another record's history.
		expect(ids).not.toContain(fact.trace.id);
		const rows = [{ id: 'log-1', entityId: plan.id }] as unknown as Log[];
		journal[0].next(rows);
		expect(reader.logs).toEqual(rows);
	});

	it('reads by id the records its journal names that the answer does not hold', async () => {
		const plan = await intentionOf(fx, 'План');
		const other = await intentionOf(fx, 'Другой план');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const { journal, repository } = controlled(fx);
		const asked: string[][] = [];
		const reader = new RecordsReader({
			...repository,
			listTraceHeads: (request) => {
				if (request.ids) asked.push([...request.ids]);
				return repository.listTraceHeads(request);
			}
		});
		await reader.load(plan.id);
		const reads = asked.length;
		// A statement moved onto this intention from another: the journal names the other one.
		const moved = {
			id: 'log-2',
			entityId: fact.assessments[0].id,
			patch: { intentionId: { before: other.id, after: plan.id } }
		} as unknown as Log;
		journal[0].next([moved]);
		await flush();
		expect(asked.slice(reads)).toEqual([[other.id]]);
		expect(reader.named.map((row) => row.id)).toEqual([other.id]);
		// The same names again: nothing is read again; ids the answer holds are not read either.
		journal[0].next([moved, { id: 'log-3', entityId: plan.id, patch: {} } as unknown as Log]);
		await flush();
		expect(asked.length).toBe(reads + 1);
		journal[0].next([
			{
				id: 'log-4',
				entityId: fact.assessments[0].id,
				patch: { intentionId: { before: fact.trace.id, after: plan.id } }
			} as unknown as Log
		]);
		await flush();
		expect([asked.length, reader.named]).toEqual([reads + 1, []]);
		reader.stopWatching();
		expect(reader.named).toEqual([]);
	});

	it('lets only the latest named read land when the set returns to an earlier one', async () => {
		const plan = await intentionOf(fx, 'План');
		const first = await intentionOf(fx, 'Первый');
		const second = await intentionOf(fx, 'Второй');
		const fact = await factFor(fx, 'Факт', plan.id, { outcome: 'completed' });
		const { journal, repository } = controlled(fx);
		// Every named read is held until the test answers it, in the order the test chooses.
		const held: {
			ids: readonly string[];
			resolve: (rows: Trace[]) => void;
			reject: (e: unknown) => void;
		}[] = [];
		const reader = new RecordsReader({
			...repository,
			listTraceHeads: (request) => {
				if (!request.ids || request.ids.length > 1 || request.ids[0] === fact.trace.id)
					return repository.listTraceHeads(request);
				return new Promise<Trace[]>((resolve, reject) => {
					held.push({ ids: request.ids!, resolve, reject });
				});
			}
		});
		await reader.load(plan.id);
		const naming = (id: string, index: number): Log =>
			({
				id: `log-${index}`,
				entityId: fact.assessments[0].id,
				patch: { intentionId: { before: id, after: plan.id } }
			}) as unknown as Log;
		// A → B → A within one journal: three reads, the first of A still in flight.
		journal[0].next([naming(first.id, 1)]);
		journal[0].next([naming(second.id, 2)]);
		journal[0].next([naming(first.id, 3)]);
		expect(held.map((entry) => entry.ids)).toEqual([[first.id], [second.id], [first.id]]);
		const fresh = [{ id: first.id, content: 'Первый (переименован)' }] as unknown as Trace[];
		const stale = [{ id: first.id, content: 'Первый' }] as unknown as Trace[];
		held[2].resolve(fresh);
		await flush();
		expect(reader.named).toBe(fresh);
		// The old read of A lands after the current one: it answers for nothing.
		held[0].resolve(stale);
		await flush();
		expect(reader.named).toBe(fresh);
		// The read of B fails late: neither an error nor a re-read of A follows.
		held[1].reject(new Error('поздно'));
		await flush();
		expect([reader.error, reader.named]).toEqual(['', fresh]);
		journal[0].next([naming(first.id, 4)]);
		await flush();
		expect(held).toHaveLength(3);
		// The current read failing is shown, and the next delivery asks again.
		journal[0].next([naming(second.id, 5)]);
		held[3].reject(new Error('отказ'));
		await flush();
		expect(reader.error).toBe('Непредвиденная ошибка: отказ');
		journal[0].next([naming(second.id, 6)]);
		expect(held.map((entry) => entry.ids).slice(3)).toEqual([[second.id], [second.id]]);
		reader.stopWatching();
		held[4].resolve([{ id: second.id } as unknown as Trace]);
		await flush();
		expect(reader.named).toEqual([]);
	});

	it('names in its journal what this record is answerable for, memberships included', async () => {
		const plan = await intentionOf(fx, 'План');
		const other = await intentionOf(fx, 'Другой план');
		const scope = await fx.repository.createScope({ name: 'Работа' });
		const membership = await fx.repository.linkTraceToScope(plan.id, scope.id);
		const left = await fx.repository.linkTraceToScope(other.id, scope.id);
		const { journal, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		// Joining a Scope and leaving one are this record's own history, not the Scope's.
		expect(journal[0].ids).toContain(membership.id);
		expect(journal[0].ids).not.toContain(left.id);
		expect(journal[0].ids).not.toContain(scope.id);
	});

	it('keeps its journal query while the same record is read again, and ends it on stop', async () => {
		const plan = await intentionOf(fx, 'План');
		const { counts, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		await reader.reload();
		// The ids did not change, so the live query was not torn down and rebuilt for nothing.
		expect([counts.journals, counts.journalStops]).toEqual([1, 0]);
		await factFor(fx, 'Факт', plan.id, { outcome: 'partial' });
		await reader.reload();
		// A new link and a new statement belong to this record's history, so the query is renewed.
		expect([counts.journals, counts.journalStops]).toEqual([2, 1]);
		reader.stopWatching();
		expect(counts.journalStops).toBe(2);
	});

	it('answers a refused subscription where it happened, without losing what it read', async () => {
		const plan = await intentionOf(fx, 'План');
		const { feeds, repository } = controlled(fx);
		const reader = new RecordsReader(repository);
		await reader.load(plan.id);
		reader.watch();
		feeds[0].fail(new Error('Подписка недоступна.'));
		expect(reader.error).toBe('Непредвиденная ошибка: Подписка недоступна.');
		expect(reader.result?.traceId).toBe(plan.id);
		reader.stopWatching();
	});
});
