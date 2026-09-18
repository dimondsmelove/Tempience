import { and, exists, or } from '@triplit/client';
import type { TempienceTriplitClient } from '../client';
import { whereIds, type QueryUse } from '../Traces/heads';
import { TRACE_FIELD_ENCODING } from '../Traces/json-encoding';
import { pathKey } from './helpers';
import type { KindIndexRequest, TraceDatasetRequest } from './types';

type Restriction = Pick<
	TraceDatasetRequest,
	'kindId' | 'kindVId' | 'ids' | 'includeDeleted' | 'time' | 'filters'
>;

/**
 * Which rows: the Kind's, one version's, a page's by id; the active ones unless asked
 * otherwise; those in a stored time range, those matching the value filters, those with a
 * standing membership in the resolved Scopes. Every predicate is a scan of the collection in
 * the installed SDK but a read's ids, which it answers by lookup; a live query names its ids
 * as a group of equalities, because concurrent `in` subscriptions on one collection answer
 * with each other's rows in that SDK (Traces/heads `whereIds`).
 */
export const restrictTraceQuery = (
	client: TempienceTriplitClient,
	request: Restriction,
	resolvedScopeIds: readonly string[] | null,
	use: QueryUse = 'live'
) => {
	let query = client.query('traces').Where('kindId', '=', request.kindId);
	if (request.ids) query = whereIds(query, request.ids, use);
	if (request.kindVId !== undefined) query = query.Where('kindVId', '=', request.kindVId);
	if (!request.includeDeleted) query = query.Where('isDeleted', '=', false);
	if (request.time?.from) query = query.Where(request.time.field, '>=', request.time.from);
	if (request.time?.to) query = query.Where(request.time.field, '<=', request.time.to);
	for (const filter of request.filters ?? []) {
		const value = Array.isArray(filter.value) ? [...filter.value] : filter.value;
		// Legacy rows keep `data.<path>`; rewritten rows store data as [value] under a marker.
		// Each branch is guarded by the marker so a legacy key "0" or a negative operator on
		// the other shape can never match the wrong rows.
		const path = pathKey(filter.path);
		query = query.Where(
			or([
				and([
					['encoding.data', 'isDefined', false],
					[`data.${path}`, filter.operator, value]
				] as never),
				and([
					['encoding.data', '=', TRACE_FIELD_ENCODING],
					[`data.0.${path}`, filter.operator, value]
				] as never)
			] as never) as never
		);
	}
	if (resolvedScopeIds !== null) {
		// In @triplit/client 1.0.50, concurrent relationship queries using `in` could reuse a
		// narrower live query view. An explicit equality group keeps each resolved set distinct.
		query = query.Where(
			exists('activeScopeMemberships', {
				where: [or(resolvedScopeIds.map((scopeId) => ['toId', '=', scopeId] as const))]
			})
		);
	}
	return query;
};

export const buildTraceQuery = (
	client: TempienceTriplitClient,
	request: TraceDatasetRequest,
	resolvedScopeIds: readonly string[] | null,
	use: QueryUse = 'live'
) => {
	let query = restrictTraceQuery(client, request, resolvedScopeIds, use);
	if (request.order) query = query.Order(request.order.field, request.order.direction);
	if (request.limit !== undefined) query = query.Limit(request.limit);

	// Both stored shapes are selected; the marker tells the projection which one applies.
	const selection = new Set<string>(['id', 'kindVId', 'encoding']);
	const selectData = (path: string): void => {
		selection.add(`data.${path}`);
		selection.add(`data.0.${path}`);
	};
	if (request.repeat) {
		const nested = request.repeat.path.indexOf('[]');
		selectData(pathKey(nested < 0 ? request.repeat.path : request.repeat.path.slice(0, nested)));
	}
	for (const column of request.columns) {
		if (column.source === 'core')
			selection.add(column.field === 'aboutDate' ? 'aboutTime' : column.field);
		if (column.source === 'data') selectData(pathKey(column.path));
	}
	return query.Select([...selection] as never);
};

/** What places and orders a record, in both stored shapes, and nothing of its data or text. */
export const KIND_INDEX_FIELDS = [
	'id',
	'kindVId',
	'aboutKind',
	'aboutTime',
	'encoding',
	'aboutAt',
	'aboutStart',
	'aboutEnd',
	'statedDuration',
	'capturedAt'
] as const;

export const buildKindIndexQuery = (
	client: TempienceTriplitClient,
	request: KindIndexRequest,
	resolvedScopeIds: readonly string[] | null
) =>
	restrictTraceQuery(
		client,
		{ kindId: request.kindId, filters: request.filters },
		resolvedScopeIds
	).Select([...KIND_INDEX_FIELDS] as never);
