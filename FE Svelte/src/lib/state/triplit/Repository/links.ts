import { exists, or } from '@triplit/client';
import type { TempienceTriplitClient } from '../client';
import {
	linkHeadsQuery,
	normalizeLinkHead,
	type LinkHead,
	type LinkHeadsRequest
} from '../Intersections/heads';
import { normalizeIntersection } from '../Intersections/read';
import type { Intersection } from '../types';
import { fetchReplica } from '../replica-fetch';

export type KindMembershipsRequest = Readonly<{
	/** One Kind's memberships, or every Kind's. */
	kindId?: string;
	/** The memberships leading to these Scopes, or to any; an empty list reads nothing. */
	scopeIds?: readonly string[];
	/** The standing memberships, or every one, withdrawn included. */
	deleted: 'active' | 'all';
}>;

/**
 * The reads of the links apart from one record's: every link thin, for the timeline and the
 * result picker; the Kinds' memberships, bounded by a Kind or by Scopes, for the Scope panel,
 * the Builder and the list of deleted Scopes; and the ids of the records that belong to one
 * Scope, for what its return would bring back. Every predicate but an id is a scan of its
 * collection in the installed SDK; these bound what is answered and kept, not the scan.
 */
export type LinkReads = {
	listLinkHeads: (request: LinkHeadsRequest) => Promise<LinkHead[]>;
	listKindMemberships: (request: KindMembershipsRequest) => Promise<Intersection[]>;
	subscribeKindMemberships: (
		request: KindMembershipsRequest,
		next: (rows: Intersection[]) => void,
		fail: (error: unknown) => void
	) => () => void;
	listMemberIds: (scopeId: string) => Promise<string[]>;
	subscribeMemberIds: (
		scopeId: string,
		next: (ids: string[]) => void,
		fail: (error: unknown) => void
	) => () => void;
};

const kindMemberships = (client: TempienceTriplitClient, request: KindMembershipsRequest) => {
	let query = client
		.query('intersections')
		.Where('fromEntityType', '=', 'traceKind')
		.Where('kind', '=', 'belongs_to');
	if (request.kindId !== undefined) query = query.Where('fromId', '=', request.kindId);
	if (request.scopeIds) {
		query = query.Where(or(request.scopeIds.map((id) => ['toId', '=', id] as const)) as never);
	}
	if (request.deleted === 'active') query = query.Where('isDeleted', '=', false);
	return query;
};

/** The active records with a standing membership in the Scope, by id only. */
const members = (client: TempienceTriplitClient, scopeId: string) =>
	client
		.query('traces')
		.Where('isDeleted', '=', false)
		.Where(exists('activeScopeMemberships', { where: [['toId', '=', scopeId]] }) as never)
		.Select(['id'] as never);

const idsOf = (rows: readonly unknown[]): string[] =>
	rows.map((row) => String((row as { id: unknown }).id));

/** A subscription of a request that names no Scope: one empty answer, nothing opened. */
const nothing = <T>(next: (rows: T[]) => void): (() => void) => {
	let open = true;
	queueMicrotask(() => {
		if (open) next([]);
	});
	return () => {
		open = false;
	};
};

export const createLinkReads = (client: TempienceTriplitClient): LinkReads => ({
	listLinkHeads: async (request) =>
		(await fetchReplica(client, linkHeadsQuery(client, request))).map((row) =>
			normalizeLinkHead(row as Record<string, unknown>)
		),
	listKindMemberships: async (request) => {
		if (request.scopeIds && request.scopeIds.length === 0) return [];
		return (await fetchReplica(client, kindMemberships(client, request))).map(
			normalizeIntersection
		);
	},
	subscribeKindMemberships: (request, next, fail) => {
		if (request.scopeIds && request.scopeIds.length === 0) return nothing(next);
		return client.subscribe(
			kindMemberships(client, request),
			(rows) => next(rows.map(normalizeIntersection)),
			fail
		);
	},
	listMemberIds: async (scopeId) => idsOf(await fetchReplica(client, members(client, scopeId))),
	subscribeMemberIds: (scopeId, next, fail) =>
		client.subscribe(members(client, scopeId), (rows) => next(idsOf(rows)), fail)
});
