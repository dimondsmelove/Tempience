import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopeTraces, scopes } from '../../db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type DbLike = typeof db | Tx;

export type SyntheticMembershipLink = {
	uid: string;
	fromKind: 'trace';
	fromUid: string;
	toKind: 'continuity';
	toUid: string;
	linkKind: 'membership';
	provenance: 'asserted';
	creator: 'user';
	evidenceJson: string;
	status: 'active';
	ownerUid: string;
	spaceUid: string;
	label: string | null;
	createdAt: string;
	updatedAt: string;
};

const SCOPE_FACETS = new Set(['thread', 'practice', 'relationship', 'condition']);

export const toScopeFacet = (continuityKind: string): string | null =>
	SCOPE_FACETS.has(continuityKind) ? continuityKind : null;

const selectAll = <T>(query: { all: () => T[] }): T[] => query.all();

export const syntheticMembershipLink = (
	scopeUid: string,
	traceUid: string,
	createdAt: string,
	label: string | null = null
): SyntheticMembershipLink => ({
	uid: `scope-trace:${scopeUid}:${traceUid}`,
	fromKind: 'trace',
	fromUid: traceUid,
	toKind: 'continuity',
	toUid: scopeUid,
	linkKind: 'membership',
	provenance: 'asserted',
	creator: 'user',
	evidenceJson: '[]',
	status: 'active',
	ownerUid: 'local-user',
	spaceUid: 'personal',
	label,
	createdAt,
	updatedAt: createdAt
});

export const ensureScopeTrace = (tx: Tx, scopeUid: string, traceUid: string, ts: string): void => {
	const [existing] = selectAll(
		tx
			.select()
			.from(scopeTraces)
			.where(and(eq(scopeTraces.scopeUid, scopeUid), eq(scopeTraces.traceUid, traceUid)))
	);
	if (existing) return;

	tx.insert(scopeTraces).values({ scopeUid, traceUid, createdAt: ts }).run();
};

export const listScopeUidsForTrace = (traceUid: string, conn: DbLike = db): string[] =>
	selectAll(
		conn
			.select({ scopeUid: scopeTraces.scopeUid })
			.from(scopeTraces)
			.where(eq(scopeTraces.traceUid, traceUid))
	).map((row) => row.scopeUid);

export const listTraceUidsForScope = (scopeUid: string, conn: DbLike = db): string[] =>
	selectAll(
		conn
			.select({ traceUid: scopeTraces.traceUid })
			.from(scopeTraces)
			.where(eq(scopeTraces.scopeUid, scopeUid))
	).map((row) => row.traceUid);

export const listScopeUidsForTraces = (traceUids: string[], conn: DbLike = db): Map<string, string[]> => {
	const result = new Map<string, string[]>();
	if (traceUids.length === 0) return result;

	const junctionRows = selectAll(
		conn
			.select({ scopeUid: scopeTraces.scopeUid, traceUid: scopeTraces.traceUid })
			.from(scopeTraces)
			.where(inArray(scopeTraces.traceUid, traceUids))
	);
	for (const row of junctionRows) {
		const list = result.get(row.traceUid) ?? [];
		list.push(row.scopeUid);
		result.set(row.traceUid, list);
	}

	for (const traceUid of traceUids) {
		const uids = result.get(traceUid);
		if (uids) result.set(traceUid, [...new Set(uids)]);
	}

	return result;
};

export const membershipLinksForTrace = (
	traceUid: string,
	conn: DbLike = db
): SyntheticMembershipLink[] => {
	const bindings = selectAll(
		conn
			.select()
			.from(scopeTraces)
			.where(eq(scopeTraces.traceUid, traceUid))
	);

	return bindings.map((row) => syntheticMembershipLink(row.scopeUid, row.traceUid, row.createdAt));
};

export const loadContinuityScopes = (uids: string[], conn: DbLike = db) =>
	selectAll(
		conn
			.select()
			.from(scopes)
			.where(and(inArray(scopes.uid, uids), eq(scopes.kind, 'continuity')))
	);
