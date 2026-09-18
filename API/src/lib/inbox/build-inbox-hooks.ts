import type { InboxHooksQuery, InboxHooksResult } from '@chronograph/shared';
import { computeHookEnrichmentState, inboxStateMatches } from '@chronograph/shared';
import { and, asc, desc, eq, gte, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db/client';
import { scopes, traceRelations, traces } from '../../db/schema';
import { listScopeUidsForTraces, membershipLinksForTrace } from '../scope/scope-trace-bindings';
import { scopeToContinuity } from '../scope/scope-mappers';
import { mapLink, mapTrace } from '../temporal-mappers';

const SALIENCE_WORDS = new Set(['поворот', 'povorot', 'turning-point']);

const defaultSince = (): string => {
	const date = new Date();
	date.setDate(date.getDate() - 7);
	return date.toISOString();
};

const buildSummary = (
	traceRow: typeof traces.$inferSelect,
	membershipCount: number,
	relatesToCount: number,
	revisitRows: Array<typeof traces.$inferSelect>
) => {
	const has_task_ref = Boolean(traceRow.taskRef);
	const revisit_count = revisitRows.length;
	const has_salience_word =
		(Boolean(traceRow.word?.trim()) &&
			SALIENCE_WORDS.has(traceRow.word!.trim().toLowerCase())) ||
		revisitRows.some(
			(row) =>
				Boolean(row.word?.trim()) &&
				SALIENCE_WORDS.has(row.word!.trim().toLowerCase())
		);

	return {
		memberships: membershipCount,
		relates_to: relatesToCount,
		has_task_ref,
		revisit_count,
		has_salience_word
	};
};

export const buildInboxHooks = async (query: InboxHooksQuery): Promise<InboxHooksResult> => {
	const since = query.since ?? defaultSince();

	const traceRows = await db
		.select()
		.from(traces)
		.where(and(gte(traces.capturedAt, since), isNull(traces.retractedAt)))
		.orderBy(desc(traces.capturedAt))
		.limit(query.limit * 3);

	if (traceRows.length === 0) {
		return { since, state: query.state, hooks: [] };
	}

	const traceUids = traceRows.map((row) => row.uid);
	const scopeUidsByTrace = listScopeUidsForTraces(traceUids);

	const relatesRows = await db
		.select()
		.from(traceRelations)
		.where(
			and(
				inArray(traceRelations.fromTraceUid, traceUids),
				eq(traceRelations.status, 'active'),
				eq(traceRelations.linkKind, 'relates_to')
			)
		);

	const relatesByTrace = new Map<string, number>();
	for (const relation of relatesRows) {
		relatesByTrace.set(
			relation.fromTraceUid,
			(relatesByTrace.get(relation.fromTraceUid) ?? 0) + 1
		);
	}

	const revisitRows = await db
		.select()
		.from(traces)
		.where(and(inArray(traces.aboutTraceUid, traceUids), isNull(traces.retractedAt)));

	const revisitsByTrace = new Map<string, Array<typeof traces.$inferSelect>>();
	for (const revisit of revisitRows) {
		if (!revisit.aboutTraceUid) continue;
		const list = revisitsByTrace.get(revisit.aboutTraceUid) ?? [];
		list.push(revisit);
		revisitsByTrace.set(revisit.aboutTraceUid, list);
	}

	const allContinuityUids = new Set<string>();
	const hooks = [];

	for (const traceRow of traceRows) {
		const membershipUids = scopeUidsByTrace.get(traceRow.uid) ?? [];
		const revisits = revisitsByTrace.get(traceRow.uid) ?? [];
		const summary = buildSummary(
			traceRow,
			membershipUids.length,
			relatesByTrace.get(traceRow.uid) ?? 0,
			revisits
		);
		const enrichment_state = computeHookEnrichmentState(summary);
		if (!inboxStateMatches(enrichment_state, query.state)) continue;

		for (const uid of membershipUids) allContinuityUids.add(uid);

		const membershipLinks = membershipLinksForTrace(traceRow.uid);

		hooks.push({
			trace: mapTrace(traceRow),
			enrichment_state,
			membership_uids: membershipUids,
			membership_links: membershipLinks.map(mapLink),
			relates_count: summary.relates_to,
			revisit_count: summary.revisit_count
		});

		if (hooks.length >= query.limit) break;
	}

	const continuityRows =
		allContinuityUids.size > 0
			? await db
					.select()
					.from(scopes)
					.where(
						and(
							inArray(scopes.uid, [...allContinuityUids]),
							eq(scopes.kind, 'continuity')
						)
					)
					.orderBy(asc(scopes.name))
			: [];

	const continuityByUid = new Map(continuityRows.map((row) => [row.uid, scopeToContinuity(row)]));

	return {
		since,
		state: query.state,
		hooks: hooks.map((hook) => ({
			trace: hook.trace,
			enrichment_state: hook.enrichment_state,
			memberships: hook.membership_links,
			continuities: hook.membership_uids
				.map((uid) => continuityByUid.get(uid))
				.filter((row): row is NonNullable<typeof row> => Boolean(row)),
			relates_count: hook.relates_count,
			revisit_count: hook.revisit_count
		}))
	} as InboxHooksResult;
};
