import type { CaptureContinuityRef, TraceMembershipsInput } from '@chronograph/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopePhases, scopeTraces, scopes, traces } from '../../db/schema';
import {
	ensureScopeTrace,
	syntheticMembershipLink,
	toScopeFacet,
	type SyntheticMembershipLink
} from '../scope/scope-trace-bindings';
import { scopeToContinuity } from '../scope/scope-mappers';
import { mapContinuitySegment, mapLink } from '../temporal-mappers';
import { newUid, nowIso } from '../time';

const MEMBERSHIP_SCOPE = {
	ownerUid: 'local-user',
	spaceUid: 'personal'
} as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const selectAll = <T>(query: { all: () => T[] }): T[] => query.all();

const resolveScopeUid = (
	tx: Tx,
	ref: CaptureContinuityRef,
	ts: string,
	createdScopes: Map<string, string>
): string => {
	if (ref.mode === 'existing') {
		const [row] = selectAll(
			tx
				.select()
				.from(scopes)
				.where(and(eq(scopes.uid, ref.continuity_uid), eq(scopes.kind, 'continuity')))
		);
		if (!row) throw new Error(`Continuity not found: ${ref.continuity_uid}`);
		return row.uid;
	}

	const cacheKey = `create:${ref.name.trim().toLowerCase()}`;
	const cached = createdScopes.get(cacheKey);
	if (cached) return cached;

	const scopeRow = {
		uid: newUid(),
		kind: 'continuity' as const,
		name: ref.name.trim(),
		parentScopeUid: null,
		startedAt: ts,
		endedAt: null,
		note: null,
		status: 'active' as const,
		supersededByUid: null,
		facet: toScopeFacet(ref.kind),
		ownerUid: MEMBERSHIP_SCOPE.ownerUid,
		spaceUid: MEMBERSHIP_SCOPE.spaceUid,
		createdAt: ts,
		updatedAt: ts
	};

	const segmentRow = {
		uid: newUid(),
		continuityUid: scopeRow.uid,
		phase: 'active' as const,
		startAt: ts,
		endAt: null,
		label: ref.initial_segment_label ?? ref.name.trim(),
		sortOrder: 0,
		createdAt: ts
	};

	tx.insert(scopes).values(scopeRow).run();
	tx.insert(scopePhases).values(segmentRow).run();
	createdScopes.set(cacheKey, scopeRow.uid);
	return scopeRow.uid;
};

const ensureMembership = (
	tx: Tx,
	traceUid: string,
	scopeUid: string,
	ts: string,
	label: string | null
): SyntheticMembershipLink => {
	const [existing] = selectAll(
		tx
			.select()
			.from(scopeTraces)
			.where(and(eq(scopeTraces.scopeUid, scopeUid), eq(scopeTraces.traceUid, traceUid)))
	);

	if (existing) {
		return syntheticMembershipLink(scopeUid, traceUid, existing.createdAt, label);
	}

	ensureScopeTrace(tx, scopeUid, traceUid, ts);
	return syntheticMembershipLink(scopeUid, traceUid, ts, label);
};

export const assertTraceMemberships = (traceUid: string, input: TraceMembershipsInput) => {
	const ts = nowIso();

	return db.transaction((tx) => {
		const [traceRow] = selectAll(tx.select().from(traces).where(eq(traces.uid, traceUid)));
		if (!traceRow) throw new Error(`Trace not found: ${traceUid}`);

		const createdScopes = new Map<string, string>();
		const scopeUids: string[] = [];

		for (const ref of input.refs) {
			scopeUids.push(resolveScopeUid(tx, ref, ts, createdScopes));
		}

		const primaryUid = input.primary_continuity_uid ?? scopeUids[0] ?? null;
		const membershipRows: SyntheticMembershipLink[] = [];

		for (const scopeUid of scopeUids) {
			const label = scopeUid === primaryUid ? 'primary' : null;
			membershipRows.push(ensureMembership(tx, traceUid, scopeUid, ts, label));
		}

		const continuityRows =
			scopeUids.length > 0
				? selectAll(
						tx
							.select()
							.from(scopes)
							.where(and(inArray(scopes.uid, scopeUids), eq(scopes.kind, 'continuity')))
							.orderBy(asc(scopes.name))
					)
				: [];

		const segmentRows =
			scopeUids.length > 0
				? selectAll(
						tx
							.select()
							.from(scopePhases)
							.where(inArray(scopePhases.continuityUid, scopeUids))
							.orderBy(asc(scopePhases.sortOrder))
					)
				: [];

		return {
			trace_uid: traceUid,
			memberships: membershipRows.map(mapLink),
			continuities: continuityRows.map(scopeToContinuity),
			segments: segmentRows.map(mapContinuitySegment)
		};
	});
};
