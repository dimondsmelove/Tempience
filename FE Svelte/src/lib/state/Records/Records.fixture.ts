import type { DraftFixture } from '$lib/state/TraceDraft/TraceDraft.fixture';
import type { Log } from '$lib/state/triplit/types';
import type { RecordsRepository } from './Records.svelte';

/** One subscribed query, answering when the test says it answers, with what it says. */
export type Feed = { next: (rows: unknown) => void; fail: (error: unknown) => void };

/** One live query of the journal, together with the records it was opened for. */
export type JournalQuery = {
	ids: readonly string[];
	next: (rows: Log[]) => void;
	fail: (error: unknown) => void;
	stopped: boolean;
};

export type FeedKey = 'record' | 'links' | 'assessments' | 'others';

/**
 * The repository of the readers with its subscriptions under the test's control: the live
 * behaviour is what is being checked, so the deliveries are made by hand, usually with the
 * replica's real current rows through `deliver`. The reads answer from the replica of the
 * fixture and can be held where the test wants them, to act on a reader while a read it was
 * asked for is still in flight. Every query is bounded by the record it was opened for.
 */
export const controlled = (fx: DraftFixture) => {
	const feeds: Feed[] = [];
	const byKey: Record<FeedKey, (Feed & { id: string; ids?: readonly string[] })[]> = {
		record: [],
		links: [],
		assessments: [],
		others: []
	};
	const journal: JournalQuery[] = [];
	const counts = { started: 0, stopped: 0, journals: 0, journalStops: 0, reads: 0 };
	let holding = false;
	let held: (() => void) | null = null;
	const subscribeTo =
		(key: FeedKey) => (id: string, next: (rows: never) => void, fail: (error: unknown) => void) => {
			counts.started += 1;
			const feed = { next: next as Feed['next'], fail, id };
			feeds.push(feed);
			byKey[key].push(feed);
			return () => {
				counts.stopped += 1;
			};
		};
	const repository: RecordsRepository = {
		readTraceRow: async (id: string) => {
			counts.reads += 1;
			// The row is read now and answered later: a read that is in flight has already read,
			// so what is delivered meanwhile is newer than what it will answer with.
			const row = await fx.repository.readTraceRow(id);
			if (holding) {
				await new Promise<void>((resolve) => {
					held = () => resolve();
				});
			}
			return row;
		},
		listIntersectionsTouching: fx.repository.listIntersectionsTouching,
		listIntentionAssessmentsFor: fx.repository.listIntentionAssessmentsFor,
		listTraceHeads: fx.repository.listTraceHeads,
		listScopes: fx.repository.listScopes,
		listTraceKinds: fx.repository.listTraceKinds,
		listTraceKindVersions: fx.repository.listTraceKindVersions,
		subscribeTraceRow: subscribeTo('record'),
		subscribeIntersectionsTouching: subscribeTo('links'),
		subscribeIntentionAssessmentsFor: subscribeTo('assessments'),
		subscribeTraceHeads: (request, next, fail) => {
			counts.started += 1;
			const feed = { next: next as Feed['next'], fail, id: '', ids: request.ids };
			feeds.push(feed);
			byKey.others.push(feed);
			return () => {
				counts.stopped += 1;
			};
		},
		subscribeLogsFor: (ids, next, fail) => {
			counts.journals += 1;
			const query: JournalQuery = { ids, next, fail, stopped: false };
			journal.push(query);
			return () => {
				counts.journalStops += 1;
				query.stopped = true;
			};
		}
	};
	/** The replica's current rows of one bounded query, as it would deliver them. */
	const rowsOf = {
		record: (id: string) => fx.repository.readTraceRow(id),
		links: (id: string) => fx.repository.listIntersectionsTouching(id),
		assessments: (id: string) => fx.repository.listIntentionAssessmentsFor(id),
		others: async (_id: string, ids: readonly string[] = []) =>
			fx.repository.listTraceHeads({ ids, deleted: 'all', summaries: [] })
	};
	return {
		feeds,
		byKey,
		journal,
		counts,
		repository,
		/** Delivers the replica's current rows on the last feed of one bounded query. */
		deliver: async (key: FeedKey) => {
			const feed = byKey[key].at(-1)!;
			feed.next(await rowsOf[key](feed.id, feed.ids));
		},
		/** Holds the record read, so the test can act while the reader is still waiting for it. */
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
