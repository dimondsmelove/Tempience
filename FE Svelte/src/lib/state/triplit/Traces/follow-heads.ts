import type { TempienceTriplitClient } from '../client';
import { idsKey } from '../TraceDataset/helpers';
import type { Trace } from '../types';
import {
	groupHeadIds,
	mergeTraceHeads,
	summaryGroups,
	traceHeadsQuery,
	traceLeavesQuery,
	type TraceHeadsRequest
} from './heads';
import { byNewestCaptured } from './read';

type LeafFeed = { ids: string; rows: readonly unknown[] | null; stop: () => void };

/**
 * Follows records thin. The heads are one live query; the leaves of each group of versions
 * are a live query of exactly the group's rows, renewed when those rows change and ended
 * when none is left. Nothing is delivered before the heads and every open leaf query have
 * answered, and every delivery is the latest of all of them: a value changed anywhere
 * reaches the list, and a delivery never shows a head without its own leaves.
 */
export const followTraceHeads = (
	client: TempienceTriplitClient,
	request: TraceHeadsRequest,
	next: (rows: Trace[]) => void,
	fail: (error: unknown) => void
): (() => void) => {
	const groups = summaryGroups(request.summaries);
	const feeds = new Map<string, LeafFeed>();
	let heads: readonly unknown[] | null = null;
	let stopped = false;

	const deliver = (): void => {
		if (heads === null) return;
		for (const feed of feeds.values()) if (feed.rows === null) return;
		const leaves = new Map<string, readonly unknown[]>();
		for (const [key, feed] of feeds) leaves.set(key, feed.rows ?? []);
		next(mergeTraceHeads(heads, leaves, groups).toSorted(byNewestCaptured));
	};

	const follow = (rows: readonly unknown[]): void => {
		const byGroup = groupHeadIds(rows, groups);
		for (const group of groups) {
			const ids = byGroup.get(group.key) ?? [];
			const key = idsKey(ids);
			const open = feeds.get(group.key);
			if (open && open.ids === key) continue;
			open?.stop();
			feeds.delete(group.key);
			if (ids.length === 0) continue;
			const feed: LeafFeed = { ids: key, rows: null, stop: () => {} };
			feeds.set(group.key, feed);
			feed.stop = client.subscribe(
				traceLeavesQuery(client, request, group, 'live', ids),
				(leafRows) => {
					if (stopped || feeds.get(group.key) !== feed) return;
					feed.rows = leafRows;
					deliver();
				},
				fail
			);
		}
	};

	const stopHeads = client.subscribe(
		traceHeadsQuery(client, request, 'live'),
		(rows) => {
			if (stopped) return;
			heads = rows;
			follow(rows);
			deliver();
		},
		fail
	);

	return () => {
		stopped = true;
		stopHeads();
		for (const feed of feeds.values()) feed.stop();
		feeds.clear();
	};
};
