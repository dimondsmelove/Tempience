import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import type { LogActor } from '../types';
import {
	createDirectAssessmentInTransaction,
	createEvidenceAssessmentInTransaction
} from './create';
import { parseAssessmentInput, refuse } from './input';
import {
	byNewestAssessed,
	hasLiveStatement,
	normalizeIntentionAssessment,
	parseStoredAssessment
} from './read';
import { assessmentFields, correctionsFor, logAssessment, storedValues } from './shared';
import type { IntentionAssessment, IntentionAssessmentValues } from './types';

export {
	createDirectAssessmentInTransaction,
	createEvidenceAssessmentInTransaction
} from './create';
export { assessmentFields } from './shared';

/**
 * A statement after one command, with the operation that wrote it: a correction's own
 * operation — which the row's lifecycle stamp never names — or a withdrawal's or a return's.
 * `null` when the statement already stood as asked and nothing was written.
 */
export type AssessmentCommandResult = {
	assessment: IntentionAssessment;
	operation: Operation | null;
};

export const editIntentionAssessmentInTransaction = async (
	transaction: Transaction,
	id: string,
	patch: IntentionAssessmentValues,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<AssessmentCommandResult> => {
	const input = parseAssessmentInput(patch, false);
	const existing = await requireEntity(transaction, 'intentionAssessments', id);
	if (existing.isDeleted === true) {
		refuse('assessment_deleted', 'Оценка удалена: восстановите её перед исправлением.');
	}
	const before = normalizeIntentionAssessment(existing);
	const overrides = correctionsFor(before, input, operation, true);
	if (!overrides) return { assessment: before, operation: null };
	// Only the touched features are sent; Triplit merges them into the stored corrections.
	await transaction.update('intentionAssessments', id, {
		values: overrides,
		updatedAt: operation.timestamp
	});
	const after = normalizeIntentionAssessment({
		...existing,
		values: { ...storedValues(existing), ...overrides },
		updatedAt: operation.timestamp
	});
	await logAssessment(transaction, operation, id, actor, {
		action: 'updated',
		patch: buildFieldPatches(before, after, assessmentFields)
	});
	return { assessment: after, operation };
};

export const setIntentionAssessmentDeletedInTransaction = async (
	transaction: Transaction,
	id: string,
	isDeleted: boolean,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<AssessmentCommandResult> => {
	const existing = await requireEntity(transaction, 'intentionAssessments', id);
	const before = normalizeIntentionAssessment(existing);
	if (before.isDeleted === isDeleted) return { assessment: before, operation: null };
	// Restore returns a withdrawn row; a source whose creations were taken back has nothing
	// to return to and is assessed anew instead.
	if (!isDeleted && !hasLiveStatement(parseStoredAssessment(existing))) {
		refuse(
			'assessment_canceled',
			'Эта оценка была отменена: оцените заново, восстанавливать нечего.'
		);
	}
	const patch = { isDeleted, lifecycleId: operation.id, updatedAt: operation.timestamp };
	await transaction.update('intentionAssessments', id, patch);
	const after = normalizeIntentionAssessment({ ...existing, ...patch });
	await logAssessment(
		transaction,
		operation,
		id,
		actor,
		{
			action: logActionForDeleted(isDeleted),
			patch: buildFieldPatches(before, after, ['isDeleted', 'lifecycleId'])
		},
		isDeleted ? 'normal' : 'restore'
	);
	return { assessment: after, operation };
};

export const createIntentionAssessmentRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	| 'createEvidenceAssessment'
	| 'createDirectAssessment'
	| 'editIntentionAssessment'
	| 'setIntentionAssessmentDeleted'
	| 'listIntentionAssessments'
> => ({
	createEvidenceAssessment: async (evidenceId, values, actor = 'user') => {
		await client.ready?.();
		return client.transact((transaction) =>
			createEvidenceAssessmentInTransaction(transaction, evidenceId, values, actor)
		);
	},
	createDirectAssessment: async (intentionId, values, actor = 'user') => {
		await client.ready?.();
		return client.transact((transaction) =>
			createDirectAssessmentInTransaction(transaction, intentionId, values, actor)
		);
	},
	editIntentionAssessment: async (id, patch, actor = 'user') => {
		await client.ready?.();
		return client.transact((transaction) =>
			editIntentionAssessmentInTransaction(transaction, id, patch, actor)
		);
	},
	setIntentionAssessmentDeleted: async (id, isDeleted, actor = 'user') => {
		await client.ready?.();
		return client.transact((transaction) =>
			setIntentionAssessmentDeletedInTransaction(transaction, id, isDeleted, actor)
		);
	},
	listIntentionAssessments: async (includeDeleted = false) => {
		await client.ready?.();
		const rows = await client.fetch('intentionAssessments');
		return rows
			.map(normalizeIntentionAssessment)
			.filter((assessment) => includeDeleted || !assessment.isDeleted)
			.toSorted(byNewestAssessed);
	}
});
