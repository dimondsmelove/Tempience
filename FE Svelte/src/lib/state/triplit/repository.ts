import { or } from '@triplit/client';
import { createAssertionRepository } from './Assertions/Assertions';
import { createCitationRepository } from './Assertions/citations';
import { createAssertionRelationRepository } from './Assertions/relations';
import { createAssertionReviewRepository } from './Assertions/review';
import { createIntentionAssessmentRepository } from './IntentionAssessments/IntentionAssessments';
import { normalizeIntentionAssessment } from './IntentionAssessments/read';
import { createEvidenceRetargetRepository } from './IntentionAssessments/retarget';
import { createIntersectionRepository } from './Intersections/Intersections';
import { normalizeIntersection } from './Intersections/read';
import { createKindRepository } from './Kinds/Kinds';
import { createKindMembershipRepository } from './Kinds/memberships';
import { compareTraceKindVersions, normalizeTraceKind, normalizeTraceKindV } from './Kinds/read';
import { createPeriodRepository } from './Periods/Periods';
import { createProvenanceRepository } from './Provenance/ProvenanceLinks';
import { asRepositoryClient } from './Repository/client';
import { createFocusedReads } from './Repository/focused';
import { createLinkReads } from './Repository/links';
import { assertStorageSchemaReady } from './Repository/readiness';
import { byNewest, createLogRepository, normalizeLog } from './Repository/log';
import type { RepositoryClient, TempienceRepository, TraceRepository } from './Repository/types';
import { createScopeRepository, normalizeScope } from './Scopes/Scopes';
import { createScopeHierarchyRepository } from './Scopes/hierarchy';
import { createScopeSegmentRepository } from './Scopes/segments';
import { createSourceRepository } from './Sources/Sources';
import { createLedgerRepository } from './Traces/Ledger';
import { createTraceCommands } from './Traces/Traces';
import { createTraceRecordRepository } from './Traces/record';
import { createUndoRepository } from './Undo/Undo';
import {
	LEAF_LOOKUP_LIMIT,
	groupHeadIds,
	mergeTraceHeads,
	summaryGroups,
	traceHeadsQuery,
	traceLeavesQuery
} from './Traces/heads';
import { followTraceHeads } from './Traces/follow-heads';
import { normalizeTrace } from './Traces/read';
import { byNewestCaptured } from './Traces/read';
import { fetchReplica } from './replica-fetch';
import { guardAiWrites } from './actor-guard';
import type { TempienceTriplitClient } from './client';
import { createScopeCaptureRepository } from './scope-capture-repository';
import { createTraceDatasetReader } from './trace-dataset';

export type {
	RepositoryClient,
	LedgerIntervalDraft,
	WeeklyBudgetDraft,
	FixedTimeIntentDraft,
	ActualDraft,
	TraceRepository,
	TempienceRepository
} from './Repository/types';
export { asRepositoryClient } from './Repository/client';
export { findTraceKindVersionHeads } from './Kinds/read';

export const createTraceRepository = (client: RepositoryClient): TraceRepository => ({
	...createLogRepository(client),
	...createTraceCommands(client),
	...createTraceRecordRepository(client),
	...createUndoRepository(client),
	...createLedgerRepository(client),
	...createKindRepository(client),
	...createKindMembershipRepository(client),
	...createPeriodRepository(client),
	...createScopeRepository(client),
	...createScopeSegmentRepository(client),
	...createScopeHierarchyRepository(client),
	...createIntersectionRepository(client),
	...createIntentionAssessmentRepository(client),
	...createEvidenceRetargetRepository(client),
	...createSourceRepository(client),
	...createAssertionRepository(client),
	...createAssertionReviewRepository(client),
	...createCitationRepository(client),
	...createAssertionRelationRepository(client),
	...createProvenanceRepository(client)
});

export const createTriplitRepository = (client: TempienceTriplitClient): TempienceRepository =>
	guardAiWrites({
		...createTraceRepository(asRepositoryClient(client)),
		...createTraceDatasetReader(client),
		...createScopeCaptureRepository(client),
		...createFocusedReads(client),
		...createLinkReads(client),
		subscribeTraceKinds: (next, fail) =>
			client.subscribe(
				client.query('traceKinds'),
				(rows) =>
					next(rows.map(normalizeTraceKind).toSorted((a, b) => a.name.localeCompare(b.name))),
				fail
			),
		subscribeTraceKindVersions: (next, fail) =>
			client.subscribe(
				client.query('traceKindVersions'),
				(rows) => next(rows.map(normalizeTraceKindV).toSorted(compareTraceKindVersions)),
				fail
			),
		subscribeDeletedScopes: (next, fail) =>
			client.subscribe(
				client.query('scopes').Where('isDeleted', '=', true),
				(rows) => next(rows.map(normalizeScope).toSorted((a, b) => a.name.localeCompare(b.name))),
				fail
			),
		subscribeScopes: (next, fail) =>
			client.subscribe(
				client.query('scopes').Where('isDeleted', '=', false),
				(rows) => next(rows.map(normalizeScope).toSorted((a, b) => a.name.localeCompare(b.name))),
				fail
			),
		subscribeIntentionAssessments: (next, fail) => {
			// The collection is newer than some stored schemas: subscribe only after the readiness check.
			let unsubscribe = (): void => {};
			let cancelled = false;
			assertStorageSchemaReady(client).then(() => {
				if (cancelled) return;
				unsubscribe = client.subscribe(
					client.query('intentionAssessments'),
					(rows) => next(rows.map(normalizeIntentionAssessment)),
					fail
				);
			}, fail);
			return () => {
				cancelled = true;
				unsubscribe();
			};
		},
		subscribeTraces: (next, fail) =>
			client.subscribe(
				client.query('traces'),
				(rows) => next(rows.map((row) => normalizeTrace(row))),
				fail
			),
		listTraceHeads: async (request) => {
			if (request.ids && request.ids.length === 0) return [];
			// The heads of every row, and the leaves of each group's rows: by id while the heads
			// are few, else the rows of the group's versions in one scan each.
			const groups = summaryGroups(request.summaries);
			const heads = await fetchReplica(client, traceHeadsQuery(client, request, 'read'));
			const byGroup = heads.length <= LEAF_LOOKUP_LIMIT ? groupHeadIds(heads, groups) : null;
			const leaves = new Map<string, readonly unknown[]>();
			await Promise.all(
				groups.map(async (group) => {
					const ids = byGroup?.get(group.key);
					if (byGroup && !ids?.length) return;
					leaves.set(
						group.key,
						await fetchReplica(client, traceLeavesQuery(client, request, group, 'read', ids))
					);
				})
			);
			return mergeTraceHeads(heads, leaves, groups).toSorted(byNewestCaptured);
		},
		subscribeTraceHeads: (request, next, fail) => {
			// A query of no records answers once, empty — on the next turn, as every subscription
			// answers after it exists: a reader that renews its query from the answer would
			// otherwise renew it inside the call that opened it, without end.
			if (request.ids && request.ids.length === 0) {
				let open = true;
				queueMicrotask(() => {
					if (open) next([]);
				});
				return () => {
					open = false;
				};
			}
			return followTraceHeads(client, request, next, fail);
		},
		subscribeIntersections: (next, fail) =>
			client.subscribe(
				client.query('intersections'),
				(rows) => next(rows.map(normalizeIntersection)),
				fail
			),
		subscribeLogsFor: (entityIds, next, fail) => {
			if (entityIds.length === 0) {
				next([]);
				return () => {};
			}
			// One live query over the journal of these records only: opening a record never
			// subscribes to the whole journal of the space.
			return client.subscribe(
				client
					.query('logs')
					.Where(or(entityIds.map((id) => ['entityId', '=', id] as const)) as never),
				(rows) => next(rows.map(normalizeLog).toSorted(byNewest)),
				fail
			);
		},
		getTrace: async (id) => {
			// The table already subscribed to this record; editing needs only its local entity.
			const row = await client.fetchById('traces', id, { policy: 'local-only' });
			return row && !row.isDeleted ? normalizeTrace(row) : null;
		}
	});
