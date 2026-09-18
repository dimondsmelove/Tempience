import type {
	CaptureScopeRef,
	CaptureMomentInput,
	CaptureMomentResult,
	CaptureSegmentBump
} from '@chronograph/shared';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopePhases, scopeTraces, scopes, traces } from '../../db/schema';
import {
	ensureScopeTrace,
	listScopeUidsForTrace,
	membershipLinksForTrace,
	syntheticMembershipLink,
	toScopeFacet,
	type SyntheticMembershipLink
} from '../scope/scope-trace-bindings';
import { scopeToContinuity } from '../scope/scope-mappers';
import { mapContinuitySegment, mapLink, mapTrace } from '../temporal-mappers';
import { newUid, nowIso } from '../time';
import { bumpContinuitySegment } from './segment-bump';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type SegmentRow = typeof scopePhases.$inferSelect;

const MEMBERSHIP_SCOPE = {
	ownerUid: 'local-user',
	spaceUid: 'personal'
} as const;

const selectAll = <T>(query: { all: () => T[] }): T[] => query.all();

const loadCaptureByIdempotency = (
	tx: Tx,
	idempotencyKey: string
): CaptureMomentResult | null => {
	const [existingTrace] = selectAll(
		tx.select().from(traces).where(eq(traces.idempotencyKey, idempotencyKey))
	);

	if (!existingTrace) return null;

	const continuityUids = [...new Set(listScopeUidsForTrace(existingTrace.uid, tx))];
	const membershipRows = membershipLinksForTrace(existingTrace.uid, tx);

	const continuityRows =
		continuityUids.length > 0
			? selectAll(
					tx
						.select()
						.from(scopes)
						.where(
							and(inArray(scopes.uid, continuityUids), eq(scopes.kind, 'continuity'))
						)
						.orderBy(asc(scopes.name))
				)
			: [];

	const segmentRows =
		continuityUids.length > 0
			? selectAll(
					tx
						.select()
						.from(scopePhases)
						.where(inArray(scopePhases.continuityUid, continuityUids))
						.orderBy(asc(scopePhases.sortOrder))
				)
			: [];

	return {
		trace: mapTrace(existingTrace),
		memberships: membershipRows.map(mapLink),
		continuities: continuityRows.map(scopeToContinuity),
		segments: segmentRows.map(mapContinuitySegment)
	} as CaptureMomentResult;
};

const resolveScopeUid = (
	tx: Tx,
	ref: CaptureScopeRef,
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
	ts: string
): SyntheticMembershipLink => {
	const [existing] = selectAll(
		tx
			.select()
			.from(scopeTraces)
			.where(and(eq(scopeTraces.scopeUid, scopeUid), eq(scopeTraces.traceUid, traceUid)))
	);

	if (existing) {
		return syntheticMembershipLink(scopeUid, traceUid, existing.createdAt);
	}

	ensureScopeTrace(tx, scopeUid, traceUid, ts);
	return syntheticMembershipLink(scopeUid, traceUid, ts);
};

const applySegmentBump = (tx: Tx, bump: CaptureSegmentBump, at: string): SegmentRow => {
	const existing = selectAll(
		tx
			.select()
			.from(scopePhases)
			.where(eq(scopePhases.continuityUid, bump.continuity_uid))
			.orderBy(asc(scopePhases.sortOrder))
	);

	return bumpContinuitySegment({
		continuityUid: bump.continuity_uid,
		at,
		label: bump.label ?? null,
		phase: 'active',
		existingSegments: existing,
		newUid,
		insertSegment: (row) => {
			tx.insert(scopePhases).values(row).run();
		},
		updateSegmentEnd: (uid, endAt) => {
			tx.update(scopePhases).set({ endAt }).where(eq(scopePhases.uid, uid)).run();
		}
	});
};

export const captureMoment = (input: CaptureMomentInput): CaptureMomentResult => {
	const ts = nowIso();
	const capturedAt = input.trace.captured_at ?? ts;
	const bumpAt = input.trace.about_at ?? input.trace.about_start ?? capturedAt;

	return db.transaction((tx) => {
		const existing = loadCaptureByIdempotency(tx, input.idempotency_key);
		if (existing) return existing;

		const traceRow = {
			uid: newUid(),
			capturedAt,
			timezone: input.trace.timezone,
			aboutKind: input.trace.about_kind,
			aboutAt: input.trace.about_at ?? null,
			aboutStart: input.trace.about_start ?? null,
			aboutEnd: input.trace.about_end ?? null,
			aboutTraceUid: input.trace.about_trace_uid ?? null,
			hookText: input.trace.hook_text,
			hookKind: input.trace.hook_kind,
			relation: input.trace.relation ?? null,
			valence: input.trace.valence ?? null,
			word: input.trace.word ?? null,
			taskRef: input.trace.task_ref ?? null,
			intentOfTraceUid: input.trace.intent_of_trace_uid ?? null,
			presence: input.trace.presence ?? null,
			idempotencyKey: input.idempotency_key,
			source: 'capture',
			retractedAt: null,
			createdAt: ts
		};

		tx.insert(traces).values(traceRow).run();

		const createdScopes = new Map<string, string>();
		const membershipRows: SyntheticMembershipLink[] = [];
		const touchedScopeUids = new Set<string>();

		for (const scopeRef of input.scopes) {
			const scopeUid = resolveScopeUid(tx, scopeRef, bumpAt, createdScopes);
			touchedScopeUids.add(scopeUid);
			membershipRows.push(ensureMembership(tx, traceRow.uid, scopeUid, ts));
		}

		for (const bump of input.segment_bumps ?? []) {
			touchedScopeUids.add(bump.continuity_uid);
			applySegmentBump(tx, bump, bumpAt);
		}

		const continuityRows =
			touchedScopeUids.size > 0
				? selectAll(
						tx
							.select()
							.from(scopes)
							.where(
								and(
									inArray(scopes.uid, [...touchedScopeUids]),
									eq(scopes.kind, 'continuity')
								)
							)
							.orderBy(asc(scopes.name))
					)
				: [];

		const segmentRows =
			touchedScopeUids.size > 0
				? selectAll(
						tx
							.select()
							.from(scopePhases)
							.where(inArray(scopePhases.continuityUid, [...touchedScopeUids]))
							.orderBy(asc(scopePhases.sortOrder))
					)
				: [];

		return {
			trace: mapTrace(traceRow),
			memberships: membershipRows.map(mapLink),
			continuities: continuityRows.map(scopeToContinuity),
			segments: segmentRows.map(mapContinuitySegment)
		} as CaptureMomentResult;
	});
};
