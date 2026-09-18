import { or } from '@triplit/client';
import type { TempienceTriplitClient } from '../client';
import { normalizeIntentionAssessment } from '../IntentionAssessments/read';
import type { IntentionAssessment } from '../IntentionAssessments/types';
import { byNewestUpdated, normalizeIntersection } from '../Intersections/read';
import { normalizeTrace } from '../Traces/read';
import type { Intersection, Trace } from '../types';
import { fetchReplica } from '../replica-fetch';

/**
 * The reads of one record, bounded by that record: the row itself, whole and whether deleted
 * or not; every link that touches it, withdrawn ones included; every statement addressed to
 * it now, addressed to it originally, or made through it as a fact. Each is one query with
 * the record's id in its predicate, read once or followed live, so opening a record reads
 * nothing of the rest of the space.
 */
type Follow<T> = (
	id: string,
	next: (rows: T[]) => void,
	fail: (error: unknown) => void
) => () => void;

export type FocusedReads = {
	readTraceRow: (id: string) => Promise<Trace | null>;
	subscribeTraceRow: (
		id: string,
		next: (row: Trace | null) => void,
		fail: (error: unknown) => void
	) => () => void;
	listIntersectionsTouching: (id: string) => Promise<Intersection[]>;
	subscribeIntersectionsTouching: Follow<Intersection>;
	listIntentionAssessmentsFor: (id: string) => Promise<IntentionAssessment[]>;
	subscribeIntentionAssessmentsFor: Follow<IntentionAssessment>;
};

const touching = (client: TempienceTriplitClient, id: string) =>
	client.query('intersections').Where(
		or([
			['fromId', '=', id],
			['toId', '=', id]
		]) as never
	);

/**
 * The stored statement keeps its origin and, once moved, its placement; a filter through an
 * absent placement is guarded by the SDK, and a placement is never written as null.
 */
const addressedTo = (client: TempienceTriplitClient, id: string) =>
	client.query('intentionAssessments').Where(
		or([
			['origin.intentionId', '=', id],
			['placement.intentionId', '=', id],
			['origin.factId', '=', id]
		]) as never
	);

export const createFocusedReads = (client: TempienceTriplitClient): FocusedReads => ({
	readTraceRow: async (id) => {
		const rows = await fetchReplica(client, client.query('traces').Where('id', '=', id));
		return rows.length ? normalizeTrace(rows[0] as Record<string, unknown>) : null;
	},
	subscribeTraceRow: (id, next, fail) =>
		client.subscribe(
			client.query('traces').Where('id', '=', id),
			(rows) => next(rows.length ? normalizeTrace(rows[0] as Record<string, unknown>) : null),
			fail
		),
	listIntersectionsTouching: async (id) =>
		(await fetchReplica(client, touching(client, id)))
			.map(normalizeIntersection)
			.toSorted(byNewestUpdated),
	subscribeIntersectionsTouching: (id, next, fail) =>
		client.subscribe(
			touching(client, id),
			(rows) => next(rows.map(normalizeIntersection).toSorted(byNewestUpdated)),
			fail
		),
	listIntentionAssessmentsFor: async (id) =>
		(await fetchReplica(client, addressedTo(client, id))).map(normalizeIntentionAssessment),
	subscribeIntentionAssessmentsFor: (id, next, fail) =>
		client.subscribe(
			addressedTo(client, id),
			(rows) => next(rows.map(normalizeIntentionAssessment)),
			fail
		)
});
