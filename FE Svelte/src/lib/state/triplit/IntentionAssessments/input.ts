import { RepositoryError, type RepositoryErrorCode } from '../Repository/errors';
import { requireEntity, type Operation } from '../Repository/transaction';
import type { Entity, Transaction } from '../Repository/types';
import { normalizeTrace } from '../Traces/read';
import { isIntentionRelation } from '../Traces/roles';
import { isAssessmentFeature, isIntentionOutcome } from './read';
import type { IntentionAssessmentValues, StoredAssessmentCandidate } from './types';

export const refuse = (
	code: RepositoryErrorCode,
	message: string,
	details: Record<string, unknown> = {}
): never => {
	throw new RepositoryError(code, message, details);
};

/** Command input: an absent key is untouched, null removes the own value. */
export const parseAssessmentInput = (
	values: IntentionAssessmentValues,
	requireValue: boolean
): IntentionAssessmentValues => {
	if (values === null || typeof values !== 'object' || Array.isArray(values)) {
		refuse('assessment_values', 'Укажите оценку намерения.', { reason: 'shape' });
	}
	for (const key of Object.keys(values)) {
		if (!isAssessmentFeature(key))
			refuse('assessment_values', `Неизвестный признак оценки: ${key}.`, {
				reason: 'feature',
				key
			});
	}
	const result: IntentionAssessmentValues = {};
	if (Object.hasOwn(values, 'outcome')) {
		const outcome = values.outcome ?? null;
		if (outcome !== null && !isIntentionOutcome(outcome)) {
			refuse('assessment_values', 'Недопустимый итог намерения.', { reason: 'outcome' });
		}
		result.outcome = outcome;
	}
	if (Object.hasOwn(values, 'open')) {
		const open = values.open ?? null;
		if (open !== null && typeof open !== 'boolean') {
			refuse('assessment_values', 'Открытость намерения задаётся явно: открыто или закрыто.', {
				reason: 'open'
			});
		}
		result.open = open;
	}
	if (requireValue && result.outcome == null && result.open == null) {
		refuse('assessment_values', 'Задайте итог или открытость намерения.', { reason: 'empty' });
	}
	return result;
};

/** Only explicitly entered values become part of a first creation. */
export const candidateFor = (
	input: IntentionAssessmentValues,
	operation: Operation
): StoredAssessmentCandidate => ({
	at: operation.timestamp,
	...(input.outcome != null ? { outcome: input.outcome } : {}),
	...(input.open != null ? { open: input.open } : {})
});

/** Roles follow the existing classification: only `relation === 'intend'` is an intention. */
export const requireIntention = async (transaction: Transaction, id: string): Promise<Entity> => {
	const row = await requireEntity(transaction, 'traces', id);
	if (row.isDeleted === true) refuse('intention_deleted', 'Намерение удалено.');
	if (!isIntentionRelation(row.relation)) {
		refuse('intention_role', 'Адресат оценки должен быть намерением.');
	}
	return row;
};

/** Evidence contributes only with an absolute event date; losing it later just silences the source. */
export const requireDatedFact = async (transaction: Transaction, id: string): Promise<Entity> => {
	const row = await requireEntity(transaction, 'traces', id);
	if (row.isDeleted === true) refuse('fact_deleted', 'Факт удалён.');
	if (isIntentionRelation(row.relation)) {
		refuse('fact_role', 'Источником оценки должен быть факт, а не намерение.');
	}
	if (normalizeTrace(row).aboutTime?.basis !== 'absolute') {
		refuse('fact_undated', 'Для оценки через факт нужна дата события.');
	}
	return row;
};
