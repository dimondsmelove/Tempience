import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { intentionOf } from '$lib/state/TraceDraft/results.fixture';
import { openDraftFixture, type DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { Intersection, Scope } from '$lib/state/triplit/types';
import { DeletedScopesReader, type DeletedScopesRepository } from './DeletedScopes.svelte';

let fx: DraftFixture;
beforeEach(() => {
	fx = openDraftFixture();
});
afterEach(async () => {
	await fx.dispose();
});

type Feed<T> = { next: (rows: T) => void; ids: readonly string[]; stopped: boolean };

/**
 * The repository with its subscriptions under the test's control — the deleted Scopes, and
 * the two queries bounded by them, recorded with the Scopes they were opened for — and its
 * Scope read held where the test wants it, to act while the reader is still waiting for it.
 */
const controlled = () => {
	const feeds: {
		scopes: Feed<Scope[]>[];
		links: Feed<Intersection[]>[];
		members: Feed<string[]>[];
	} = { scopes: [], links: [], members: [] };
	let holding = false;
	let held: (() => void) | null = null;
	/** The counts' read, held after it has read — the second phase of a load. */
	let holdingCounts = false;
	const heldCounts: (() => void)[] = [];
	let countsEntered: (() => void) | null = null;
	const record =
		<T>(list: Feed<T>[], ids: readonly string[]) =>
		(next: (rows: T) => void) => {
			const feed: Feed<T> = { next, ids, stopped: false };
			list.push(feed);
			return () => {
				feed.stopped = true;
			};
		};
	const repository: DeletedScopesRepository = {
		listScopes: async (includeDeleted?: boolean) => {
			// The rows are read now and answered later: a read that is in flight has already read.
			const rows = await fx.repository.listScopes(includeDeleted);
			if (holding) {
				await new Promise<void>((resolve) => {
					held = () => resolve();
				});
			}
			return rows;
		},
		listTraceKinds: fx.repository.listTraceKinds,
		listKindMemberships: fx.repository.listKindMemberships,
		listMemberIds: async (scopeId: string) => {
			const ids = await fx.repository.listMemberIds(scopeId);
			if (holdingCounts) {
				countsEntered?.();
				await new Promise<void>((resolve) => {
					heldCounts.push(resolve);
				});
			}
			return ids;
		},
		subscribeDeletedScopes: (next) => record(feeds.scopes, [])(next),
		subscribeKindMemberships: (request, next) => record(feeds.links, request.scopeIds ?? [])(next),
		subscribeMemberIds: (scopeId, next) => record(feeds.members, [scopeId])(next)
	};
	const open = <T>(list: Feed<T>[]) => list.filter((feed) => !feed.stopped);
	/** The replica's current deleted Scopes, as the subscription would deliver them. */
	const deliverScopes = async () =>
		feeds.scopes
			.at(-1)!
			.next((await fx.repository.listScopes(true)).filter((scope) => scope.isDeleted));
	/** The replica's current rows of every open bounded query, as they would deliver them. */
	const deliverBound = async () => {
		for (const feed of open(feeds.links)) {
			feed.next(await fx.repository.listKindMemberships({ scopeIds: feed.ids, deleted: 'all' }));
		}
		for (const feed of open(feeds.members)) {
			feed.next(await fx.repository.listMemberIds(feed.ids[0]));
		}
	};
	return {
		feeds,
		open,
		repository,
		deliverScopes,
		deliverBound,
		hold: () => {
			holding = true;
		},
		release: () => {
			holding = false;
			held?.();
			held = null;
		},
		/** Resolves once a counts' read is being held, so the test acts inside the second phase. */
		holdCounts: () =>
			new Promise<void>((resolve) => {
				holdingCounts = true;
				countsEntered = resolve;
			}),
		releaseCounts: () => {
			holdingCounts = false;
			countsEntered = null;
			for (const resolve of heldCounts.splice(0)) resolve();
		}
	};
};

describe('the deleted Scopes and what their return would bring back', () => {
	it('names the Kind memberships this deletion hid, and not one withdrawn since', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		const rest = await fx.repository.createScope({ name: 'Отдых' });
		const schema = { initialKindV: { dataSchema: { type: 'object', properties: {} } } };
		const { kind: kept } = await fx.repository.createTraceKind({ name: 'Оставленный', ...schema });
		const { kind: left } = await fx.repository.createTraceKind({ name: 'Ушедший', ...schema });
		await fx.repository.setTraceKindScopes(kept.id, [work.id, rest.id]);
		await fx.repository.setTraceKindScopes(left.id, [work.id]);
		const plan = await intentionOf(fx, 'План', [work.id]);
		const gone = await intentionOf(fx, 'Удалённый', [work.id]);
		await fx.repository.setTraceDeleted(gone.id, true, 'user');
		const { repository } = controlled();
		const deleted = new DeletedScopesReader(repository);
		await deleted.load();
		expect(deleted.records).toEqual([]);
		await fx.repository.setScopeDeleted(work.id, true, 'user');
		// The other Kind leaves every Scope explicitly while this one is deleted.
		await fx.repository.setTraceKindScopes(left.id, []);
		await deleted.load();
		expect(deleted.records).toHaveLength(1);
		expect(deleted.records[0].scope.id).toBe(work.id);
		// Only the membership still carrying this deletion's stamp returns; the record was never
		// touched, and the deleted record is not counted.
		expect(deleted.records[0].returning).toEqual([{ id: kept.id, name: 'Оставленный' }]);
		expect(deleted.records[0].records).toBe(1);
		expect(plan.id).toBeTruthy();
	});

	it('keeps the first answer that arrives before the first read has landed', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		const { repository, hold, release, deliverScopes, deliverBound } = controlled();
		const deleted = new DeletedScopesReader(repository);
		// The read starts while the Scope is still active and is held there; following starts.
		hold();
		const reading = deleted.load();
		const stop = deleted.watch();
		// The Scope is deleted now, and the subscription's first — and only — answer says so.
		await fx.repository.setScopeDeleted(work.id, true, 'user');
		await deliverScopes();
		await deliverBound();
		// The held read lands with the older rows: the delivered ones are the newer truth.
		release();
		await reading;
		expect(deleted.records.map((entry) => entry.scope.id)).toEqual([work.id]);
		stop();
	});

	it('keeps a delivery that arrives while a later read is in flight, over that read', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		const { repository, hold, release, deliverScopes, deliverBound } = controlled();
		const deleted = new DeletedScopesReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		expect(deleted.records).toEqual([]);
		hold();
		const reading = deleted.load();
		await fx.repository.setScopeDeleted(work.id, true, 'user');
		await deliverScopes();
		await deliverBound();
		expect(deleted.records.map((entry) => entry.scope.id)).toEqual([work.id]);
		release();
		await reading;
		expect(deleted.records.map((entry) => entry.scope.id)).toEqual([work.id]);
		stop();
	});

	it('opens the bounded queries for exactly the deleted Scopes, renews them, and ends them', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		const rest = await fx.repository.createScope({ name: 'Отдых' });
		await intentionOf(fx, 'План', [work.id]);
		await fx.repository.setScopeDeleted(work.id, true, 'user');
		const { feeds, open, repository, deliverScopes, deliverBound } = controlled();
		const deleted = new DeletedScopesReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		// One memberships query for the deleted Scopes, one members query per deleted Scope.
		expect(open(feeds.links).map((feed) => feed.ids)).toEqual([[work.id]]);
		expect(open(feeds.members).map((feed) => feed.ids)).toEqual([[work.id]]);
		// A second Scope is deleted: the delivery renews the bounded queries for both.
		await fx.repository.setScopeDeleted(rest.id, true, 'user');
		await deliverScopes();
		const both = [work.id, rest.id].toSorted();
		expect(open(feeds.links).map((feed) => feed.ids.toSorted())).toEqual([both]);
		expect(
			open(feeds.members)
				.map((feed) => feed.ids[0])
				.toSorted()
		).toEqual(both);
		await deliverBound();
		expect(
			deleted.records
				.map((entry) => [entry.scope.id, entry.records] as const)
				.toSorted((left, right) => left[0].localeCompare(right[0]))
		).toEqual(
			[[work.id, 1] as const, [rest.id, 0] as const].toSorted((l, r) => l[0].localeCompare(r[0]))
		);
		stop();
		expect([...feeds.scopes, ...feeds.links, ...feeds.members].every((feed) => feed.stopped)).toBe(
			true
		);
		// A late delivery of the ended subscriptions changes nothing.
		feeds.scopes[0].next([]);
		expect(deleted.records).toHaveLength(2);
	});

	it('keeps a Scope brought back while its records were being counted, over that count', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		await intentionOf(fx, 'План', [work.id]);
		await fx.repository.setScopeDeleted(work.id, true, 'user');
		const { repository, holdCounts, releaseCounts, deliverScopes, deliverBound } = controlled();
		const deleted = new DeletedScopesReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		expect(deleted.records.map((entry) => entry.scope.id)).toEqual([work.id]);
		// A later read has read the Scopes and is counting their records when the Scope comes back.
		const entered = holdCounts();
		const reading = deleted.load();
		await entered;
		await fx.repository.setScopeDeleted(work.id, false, 'user');
		await deliverScopes();
		expect(deleted.records).toEqual([]);
		// The count of a Scope that is not deleted any more lands: the delivery stands.
		releaseCounts();
		await reading;
		expect(deleted.records).toEqual([]);
		await deliverBound();
		expect(deleted.records).toEqual([]);
		stop();
	});

	it('shows a Scope deleted while records were being counted, with the counts of the current Scopes', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		const rest = await fx.repository.createScope({ name: 'Отдых' });
		await intentionOf(fx, 'План', [work.id]);
		await intentionOf(fx, 'Отпуск', [rest.id]);
		await intentionOf(fx, 'Ещё отпуск', [rest.id]);
		await fx.repository.setScopeDeleted(work.id, true, 'user');
		const { repository, holdCounts, releaseCounts, deliverScopes, deliverBound } = controlled();
		const deleted = new DeletedScopesReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		const entered = holdCounts();
		const reading = deleted.load();
		await entered;
		// A second Scope is deleted while the first one's records are being counted: the
		// delivery renews the bounded queries for both, and their answers arrive.
		await fx.repository.setScopeDeleted(rest.id, true, 'user');
		await deliverScopes();
		await deliverBound();
		const shown = () =>
			deleted.records
				.map((entry) => [entry.scope.id, entry.records] as const)
				.toSorted((left, right) => left[0].localeCompare(right[0]));
		const both = [
			[work.id, 1],
			[rest.id, 2]
		].toSorted((left, right) => String(left[0]).localeCompare(String(right[0])));
		expect(shown()).toEqual(both);
		// The held read lands with the older Scopes and the older count: the delivery stands.
		releaseCounts();
		await reading;
		expect(shown()).toEqual(both);
		stop();
	});

	it('shows a deleted Scope once its records have been counted, and follows the count', async () => {
		const work = await fx.repository.createScope({ name: 'Работа' });
		const { feeds, open, repository } = controlled();
		const deleted = new DeletedScopesReader(repository);
		await deleted.load();
		const stop = deleted.watch();
		const { scope } = await fx.repository.setScopeDeleted(work.id, true, 'user');
		feeds.scopes[0].next([scope]);
		// Delivered before its bounded queries have answered: not yet shown with a wrong count.
		expect(deleted.records).toEqual([]);
		open(feeds.links)[0].next([]);
		open(feeds.members)[0].next(['a', 'b']);
		expect(deleted.records.map((entry) => [entry.scope.id, entry.records])).toEqual([[work.id, 2]]);
		open(feeds.members)[0].next(['a']);
		expect(deleted.records[0].records).toBe(1);
		stop();
	});
});
