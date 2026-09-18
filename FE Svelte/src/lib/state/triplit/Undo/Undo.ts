import { intersectionActivationId, normalizeIntersection } from '../Intersections/read';
import { setIntentionAssessmentDeletedInTransaction } from '../IntentionAssessments/IntentionAssessments';
import {
	normalizeIntentionAssessment,
	parseStoredAssessment,
	sortedAssessmentCandidates
} from '../IntentionAssessments/read';
import { assessmentFields, logAssessment, storedValues } from '../IntentionAssessments/shared';
import type { StoredAssessmentOverride } from '../IntentionAssessments/types';
import { setIntersectionDeletedInTransaction } from '../Intersections/Intersections';
import { normalizeLog } from '../Repository/log';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type {
	Collection,
	RepositoryClient,
	TraceRepository,
	Transaction
} from '../Repository/types';
import { setScopeDeletedInTransaction } from '../Scopes/Scopes';
import { editTraceInTransaction, setTraceDeletedInTransaction } from '../Traces/edit';
import { assertSupplementIntegrity } from '../Traces/supplement';
import { buildFieldPatches } from '../operations';
import type { LogActor, TracePatch } from '../types';
import { assertInvertible } from './guards';
import { planInverse, type InversePlan, type InverseStep } from './plan';

export type UndoResult = { operation: Operation; plan: InversePlan };

/**
 * Restores first, then placements and features, then withdrawals and repeated deletions, own
 * fields before the record's own re-deletion: role, pair and lifecycle guards of the helpers
 * see the end state, and a feature is corrected while its source is still active.
 */
const rank = (step: InverseStep): number => {
	const restores = 'deleted' in step && step.deleted;
	switch (step.kind) {
		case 'trace.lifecycle':
			return restores ? 0 : 11;
		case 'scope.lifecycle':
			return 1;
		case 'link.lifecycle':
			return restores ? 2 : 7;
		case 'assessment.lifecycle':
			return restores ? 3 : 9;
		case 'assessment.placement':
			return 4;
		case 'assessment.values':
			return 5;
		case 'link.created':
			return 6;
		case 'assessment.created':
			return 8;
		case 'trace.fields':
			return 10;
	}
};

const ordered = (steps: readonly InverseStep[]): InverseStep[] =>
	steps.toSorted((left, right) => rank(left) - rank(right));

const returnPlacement = async (
	transaction: Transaction,
	step: InverseStep & { kind: 'assessment.placement' },
	actor: LogActor,
	operation: Operation
): Promise<void> => {
	const row = await requireEntity(transaction, 'intentionAssessments', step.assessmentId);
	const link = normalizeIntersection(
		await requireEntity(transaction, 'intersections', step.before.evidenceId)
	);
	const before = normalizeIntentionAssessment(row);
	const patch = {
		placement: {
			intentionId: step.before.intentionId,
			evidenceId: link.id,
			activationId: intersectionActivationId(link),
			operationId: operation.id
		},
		lifecycleId: operation.id,
		updatedAt: operation.timestamp
	};
	await transaction.update('intentionAssessments', step.assessmentId, patch);
	const after = normalizeIntentionAssessment({ ...row, ...patch });
	await logAssessment(transaction, operation, step.assessmentId, actor, {
		action: 'updated',
		patch: buildFieldPatches(before, after, assessmentFields)
	});
};

/**
 * Changed features go back to their before values, restated ones keep their value; both take
 * this operation's revision, so a later inverse of an older correction reads as stale. Each
 * slot names whose statement it re-expresses: an earlier correction stays a live statement
 * of the source, a value that came from first creations does not — a withdrawn creation is
 * never revived through the slot, and the slot cannot outlive the creations on its own.
 */
const restateValues = async (
	transaction: Transaction,
	step: InverseStep & { kind: 'assessment.values' },
	actor: LogActor,
	operation: Operation
): Promise<void> => {
	const row = await requireEntity(transaction, 'intentionAssessments', step.assessmentId);
	const stored = parseStoredAssessment(row);
	const before = normalizeIntentionAssessment(row);
	const statement = (ownerBefore: string | null): string | null =>
		ownerBefore !== null && stored.initial[ownerBefore] === undefined ? ownerBefore : null;
	const overrides: Record<string, StoredAssessmentOverride<unknown>> = {};
	for (const [feature, change] of Object.entries(step.features)) {
		overrides[feature] = {
			value: change.before ?? null,
			operationId: operation.id,
			statement: statement(change.ownerBefore)
		};
	}
	for (const { feature, ownerBefore } of step.restated) {
		overrides[feature] = {
			value: before[feature],
			operationId: operation.id,
			statement: statement(ownerBefore)
		};
	}
	const patch = { values: overrides, updatedAt: operation.timestamp };
	await transaction.update('intentionAssessments', step.assessmentId, patch);
	const after = normalizeIntentionAssessment({
		...row,
		values: { ...storedValues(row), ...overrides },
		updatedAt: operation.timestamp
	});
	await logAssessment(transaction, operation, step.assessmentId, actor, {
		action: 'updated',
		patch: buildFieldPatches(before, after, assessmentFields)
	});
};

/**
 * The action's own first creation is withdrawn as a candidate, never the row: another first
 * creation of the same source, known here or arriving later from another replica, keeps the
 * source alive with its own values, and the withdrawn one no longer counts anywhere.
 */
const withdrawCandidate = async (
	transaction: Transaction,
	step: InverseStep & { kind: 'assessment.created' },
	actor: LogActor,
	operation: Operation,
	undone: string
): Promise<void> => {
	const row = await requireEntity(transaction, 'intentionAssessments', step.assessmentId);
	const before = normalizeIntentionAssessment(row);
	const stored = parseStoredAssessment(row);
	const candidate = { ...stored.initial[undone], withdrawn: operation.id };
	const patch = {
		initial: { [undone]: candidate },
		lifecycleId: operation.id,
		updatedAt: operation.timestamp
	};
	await transaction.update('intentionAssessments', step.assessmentId, patch);
	const merged = { ...row, ...patch, initial: { ...stored.initial, [undone]: candidate } };
	const after = normalizeIntentionAssessment(merged);
	await logAssessment(transaction, operation, step.assessmentId, actor, {
		action: 'deleted',
		patch: {
			...buildFieldPatches(before, after, assessmentFields),
			candidates: {
				before: sortedAssessmentCandidates(stored).map(([id]) => id),
				after: sortedAssessmentCandidates(parseStoredAssessment(merged)).map(([id]) => id)
			}
		}
	});
};

const compensate = async (
	transaction: Transaction,
	step: InverseStep,
	actor: LogActor,
	operation: Operation,
	undone: string
): Promise<void> => {
	switch (step.kind) {
		case 'trace.lifecycle':
			await setTraceDeletedInTransaction(
				transaction,
				step.traceId,
				!step.deleted,
				actor,
				operation
			);
			return;
		case 'scope.lifecycle':
			await setScopeDeletedInTransaction(
				transaction,
				step.scopeId,
				false,
				actor,
				operation,
				undone
			);
			return;
		case 'link.lifecycle':
			await setIntersectionDeletedInTransaction(
				transaction,
				step.linkId,
				!step.deleted,
				actor,
				operation
			);
			return;
		case 'link.created':
			await setIntersectionDeletedInTransaction(transaction, step.linkId, true, actor, operation);
			return;
		case 'assessment.lifecycle':
			await setIntentionAssessmentDeletedInTransaction(
				transaction,
				step.assessmentId,
				!step.deleted,
				actor,
				operation
			);
			return;
		case 'assessment.created':
			await withdrawCandidate(transaction, step, actor, operation, undone);
			return;
		case 'assessment.placement':
			await returnPlacement(transaction, step, actor, operation);
			return;
		case 'assessment.values':
			await restateValues(transaction, step, actor, operation);
			return;
		case 'trace.fields': {
			const patch = Object.fromEntries(
				Object.entries(step.fields).map(([field, change]) => [field, change.before ?? null])
			) as TracePatch;
			await editTraceInTransaction(transaction, step.traceId, patch, actor, operation);
			return;
		}
	}
};

/**
 * Compensates one committed operation through the original records: its journal names the
 * consequences, every consequence must still be current (identity, lifecycle, placement,
 * field and feature revisions), and all of them are undone in one transaction under one new
 * operation whose Log entries carry cause=undo. A stale, unavailable or unsupported
 * consequence refuses the whole inverse before any write; a repeated inverse reads as stale.
 */
export const undoOperationInTransaction = async (
	transaction: Transaction,
	operationId: string,
	actor: LogActor
): Promise<UndoResult> => {
	const logs = (await transaction.fetch('logs')).map(normalizeLog);
	const plan = planInverse(logs, operationId);
	await assertInvertible({ transaction, plan });
	const operation = newOperation('undo');
	for (const step of ordered(plan.steps)) {
		await compensate(transaction, step, actor, operation, operationId);
	}
	for (const step of plan.steps) {
		if (step.kind === 'trace.fields' || step.kind === 'trace.lifecycle') {
			await assertSupplementIntegrity(transaction, step.traceId);
		}
	}
	return { operation, plan };
};

/** The rows an inverse reads and writes: one per step, by the collection the step names. */
export const planRows = (plan: InversePlan): { collection: Collection; id: string }[] =>
	plan.steps.map((step) =>
		'traceId' in step
			? { collection: 'traces', id: step.traceId }
			: 'linkId' in step
				? { collection: 'intersections', id: step.linkId }
				: 'assessmentId' in step
					? { collection: 'intentionAssessments', id: step.assessmentId }
					: { collection: 'scopes', id: step.scopeId }
	);

export const createUndoRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'undoOperation'> => ({
	undoOperation: async (operationId, actor = 'user') => {
		// Compensating writes of JSON fields use the atomic shape, which needs the current schema.
		await client.ready?.();
		// Under sync, a row that left every subscription — the record just deleted — is no longer
		// in the store the transaction reads (#37): the inverse pulls the rows its plan names first.
		if (client.warm) {
			const logs = (await client.transact((transaction) => transaction.fetch('logs'))).map(
				normalizeLog
			);
			const rows = planRows(planInverse(logs, operationId));
			// Scope steps restore their memberships; placement steps read the previous evidence.
			// Those links appear in the journal even when no inverse step names them directly.
			for (const log of logs) {
				if (
					log.operationId === operationId &&
					log.entityType === 'intersection' &&
					!rows.some((row) => row.collection === 'intersections' && row.id === log.entityId)
				)
					rows.push({ collection: 'intersections', id: log.entityId });
			}
			await client.warm(rows);
		}
		return client.transact((transaction) =>
			undoOperationInTransaction(transaction, operationId, actor)
		);
	}
});
