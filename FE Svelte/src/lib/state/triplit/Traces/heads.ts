import { or } from '@triplit/client';
import type { VersionSummary } from '$lib/model/TraceForm/summary-fields';
import type { TempienceTriplitClient } from '../client';
import { pathKey } from '../TraceDataset/helpers';
import type { Trace, TraceRelation } from '../types';
import { parseTraceEncoding } from './json-encoding';
import { normalizeTrace } from './read';

/**
 * A thin read of records: every field a row of the timeline or of a list needs, and of the
 * typed data only the summary leaves of the record's own Kind version (`summaries`), never
 * the rest and never another version's. The Context reads the whole selected record through
 * its own reader; nothing else needs a record's whole data, and at scale the rest of it is
 * most of the payload.
 *
 * The read is two steps. The heads of every row are one query without any data path: the
 * installed SDK reads a selected path through its parent and throws where that parent is
 * null (`ValuePointer.Get` guards undefined only), and a plain record's data is null, as a
 * nullable field of one schema may be under a key another schema nests. Then, per group of
 * versions with the same leaves, those leaves are read for exactly the group's rows — the
 * rows of its versions under the same restriction, one scan each, or the named rows by id —
 * and merged into their heads. A record whose version is not among the summaries, or whose
 * version has no leaf, holds no data.
 */
export type TraceHeadsRequest = Readonly<{
	/** Which records: the active ones, the deleted ones, or all of them. */
	deleted?: 'active' | 'deleted' | 'all';
	/** Only these records, when given; an empty list reads nothing. */
	ids?: readonly string[];
	relation?: TraceRelation;
	/** The summary leaves of the versions the records may have; each record gets its own. */
	summaries: readonly VersionSummary[];
}>;

/** The fields of a record apart from its data: what every row is placed, named and read by. */
export const TRACE_HEAD_FIELDS = [
	'id',
	'capturedAt',
	'timezone',
	'aboutKind',
	'aboutTime',
	'encoding',
	'aboutAt',
	'aboutStart',
	'aboutEnd',
	'statedDuration',
	'aboutTraceId',
	'content',
	'description',
	'relation',
	'kindId',
	'kindVId',
	'isDeleted',
	'revisions',
	'createdAt',
	'updatedAt'
] as const;

/**
 * Up to this many heads take their leaves by id, a lookup each; more take them by version,
 * one scan per group. Measured in the memory SDK at 100K rows: a lookup costs about 0.1 ms
 * a row, so 90K of them took 8.8 s where the scans took 1.8 s, and a scan of the collection
 * costs 150–250 ms — about the lookups of 500 rows.
 */
export const LEAF_LOOKUP_LIMIT = 500;

/** The versions whose summary leaves are the same, read as one: one selection, one query. */
export type SummaryGroup = Readonly<{
	key: string;
	kindVIds: readonly string[];
	paths: readonly (readonly string[])[];
}>;

export const summaryGroups = (summaries: readonly VersionSummary[]): SummaryGroup[] => {
	const groups = new Map<string, { kindVIds: string[]; paths: readonly (readonly string[])[] }>();
	for (const summary of summaries) {
		if (summary.paths.length === 0) continue;
		const key = summary.paths.map(pathKey).toSorted().join('\u0000');
		const group = groups.get(key) ?? { kindVIds: [], paths: summary.paths };
		group.kindVIds.push(summary.kindVId);
		groups.set(key, group);
	}
	return [...groups.entries()]
		.map(([key, group]) => ({ key, ...group }))
		.toSorted((a, b) => a.key.localeCompare(b.key));
};

/** The selection of a group's leaves: both stored shapes of every named data path. */
export const leafSelection = (paths: readonly (readonly string[])[]): string[] => {
	const selection = new Set<string>(['id', 'encoding']);
	for (const path of paths) {
		const key = pathKey(path);
		selection.add(`data.${key}`);
		selection.add(`data.0.${key}`);
	}
	return [...selection];
};

/** Whether the query is read once or followed: the two name their ids differently. */
export type QueryUse = 'read' | 'live';

/**
 * The records named by id. A read names them in one top-level `in`: the one predicate the
 * SDK answers by lookup instead of a scan of the collection (query-planner/heuristics
 * getIdFilter: '=' or 'in' on id, not in a group). A live query names them as a group of
 * equalities instead: in the installed SDK (1.0.50) concurrent `in` subscriptions on one
 * collection answer with each other's rows, as the record reader's tests reproduce, and a
 * group of equalities does not — at the price of a scan for the first answer.
 */
export const whereIds = <Query extends { Where: (...args: never[]) => unknown }>(
	query: Query,
	ids: readonly string[],
	use: QueryUse
): Query => {
	// The builder's Where reads its own query: it is called as a method, never detached.
	const where = (...args: unknown[]): Query =>
		(query.Where as (...args: unknown[]) => Query).apply(query, args);
	return use === 'read'
		? where('id', 'in', [...ids])
		: where(or(ids.map((id) => ['id', '=', id] as const)));
};

const restrict = (client: TempienceTriplitClient, request: TraceHeadsRequest, use: QueryUse) => {
	let query = client.query('traces');
	if (request.deleted !== 'all') {
		query = query.Where('isDeleted', '=', request.deleted === 'deleted');
	}
	if (request.relation) query = query.Where('relation', '=', request.relation);
	if (request.ids) query = whereIds(query, request.ids, use);
	return query;
};

export const traceHeadsQuery = (
	client: TempienceTriplitClient,
	request: TraceHeadsRequest,
	use: QueryUse
) => restrict(client, request, use).Select([...TRACE_HEAD_FIELDS] as never);

/**
 * The leaves of one group's rows: the named rows by id — a lookup when read, and what a
 * live query renews when the rows change — or, for a read of every row, the rows of the
 * group's versions under the request's restriction in one scan: at scale, the lookup of
 * every row of a version by id costs many times the scan (measured: 8.8 s against 1.8 s for
 * 100K rows in the memory SDK).
 */
export const traceLeavesQuery = (
	client: TempienceTriplitClient,
	request: TraceHeadsRequest,
	group: SummaryGroup,
	use: QueryUse,
	ids?: readonly string[]
) => {
	const rows = ids
		? whereIds(client.query('traces'), ids, use)
		: restrict(client, request, use).Where(
				or(group.kindVIds.map((kindVId) => ['kindVId', '=', kindVId] as const)) as never
			);
	return rows.Select(leafSelection(group.paths) as never);
};

type Row = Record<string, unknown>;

/** The ids of the heads of each group's versions, in the heads' order. */
export const groupHeadIds = (
	heads: readonly unknown[],
	groups: readonly SummaryGroup[]
): Map<string, string[]> => {
	const groupOf = new Map<string, string>();
	for (const group of groups) for (const kindVId of group.kindVIds) groupOf.set(kindVId, group.key);
	const ids = new Map<string, string[]>();
	for (const head of heads as Row[]) {
		const key = typeof head.kindVId === 'string' ? groupOf.get(head.kindVId) : undefined;
		if (key === undefined) continue;
		// Appended in place: a copy of the group per head made this quadratic in the heads.
		let group = ids.get(key);
		if (!group) ids.set(key, (group = []));
		group.push(String(head.id));
	}
	return ids;
};

/**
 * A head with its leaf row: the data and the data's own shape marker come from the leaf row
 * together, so a head that answered after an edit and a leaf row that has not yet are still
 * read each in its own shape; the time's marker stays the head's.
 */
const withLeaf = (head: Row, leaf: Row): Row => {
	const encoding: Record<string, unknown> = { ...parseTraceEncoding(head.encoding) };
	delete encoding.data;
	const data = parseTraceEncoding(leaf.encoding).data;
	if (data !== undefined) encoding.data = data;
	return {
		...head,
		data: leaf.data,
		...(Object.keys(encoding).length ? { encoding } : { encoding: undefined })
	};
};

/** The heads with the leaves of their own version merged in, as records. */
export const mergeTraceHeads = (
	heads: readonly unknown[],
	leaves: ReadonlyMap<string, readonly unknown[]>,
	groups: readonly SummaryGroup[]
): Trace[] => {
	const groupOf = new Map<string, string>();
	for (const group of groups) for (const kindVId of group.kindVIds) groupOf.set(kindVId, group.key);
	const leavesById = new Map<string, Row>();
	for (const rows of leaves.values())
		for (const row of rows as Row[]) leavesById.set(String(row.id), row);
	return (heads as Row[]).map((head) => {
		const leaf = leavesById.get(String(head.id));
		const own = typeof head.kindVId === 'string' && groupOf.has(head.kindVId);
		return normalizeTrace(own && leaf ? withLeaf(head, leaf) : head, 'selected');
	});
};
