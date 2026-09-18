import { intersectionActivationId, normalizeIntersection } from '../Intersections/read';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { Transaction } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import type { LogActor } from '../types';
import { linkSourceId, resolveLinkSource } from './binding';
import {
	candidateFor,
	parseAssessmentInput,
	refuse,
	requireDatedFact,
	requireIntention
} from './input';
import { hasLiveStatement, normalizeIntentionAssessment, parseStoredAssessment } from './read';
import { assessmentFields, correctionsFor, logAssessment, storedValues } from './shared';
import type { IntentionAssessment, IntentionAssessmentValues } from './types';

export const createEvidenceAssessmentInTransaction = async (
	transaction: Transaction,
	evidenceId: string,
	values: IntentionAssessmentValues,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<IntentionAssessment> => {
	const input = parseAssessmentInput(values, true);
	const linkRow = await requireEntity(transaction, 'intersections', evidenceId);
	if (linkRow.kind !== 'evidence_for') {
		refuse('evidence_kind', 'Оценка относится только к связи «результат для».');
	}
	if (linkRow.isDeleted === true) {
		refuse(
			'evidence_inactive',
			'Связь снята: оценка возможна после восстановления или новой связи.'
		);
	}
	const link = normalizeIntersection(linkRow);
	await requireDatedFact(transaction, link.fromId);
	await requireIntention(transaction, link.toId);
	const activationId = intersectionActivationId(link);
	// The link names its source; the source must still be addressed to this link to be acted on.
	const resolved = resolveLinkSource(
		link,
		await transaction.fetchById('intentionAssessments', linkSourceId(link))
	);
	const id = linkSourceId(link);
	if (resolved.status === 'unavailable') {
		refuse('source_unavailable', 'Перенесённая оценка этой связи недоступна; повторите позже.', {
			linkId: link.id,
			assessmentId: resolved.assessmentId
		});
	}
	if (resolved.status === 'detached') {
		refuse(
			'source_detached',
			'Эта связь ссылается на оценку, которая теперь принадлежит другой связи: действуйте через актуальную связь.',
			{
				linkId: link.id,
				assessmentId: resolved.assessment.id,
				currentEvidenceId: resolved.assessment.evidenceId
			}
		);
	}
	if (resolved.status === 'current') {
		refuse('assessment_exists', 'Оценка этой связи уже есть: исправьте её вместо новой.');
	}
	const existing =
		resolved.status === 'withdrawn'
			? await transaction.fetchById('intentionAssessments', id)
			: null;
	if (existing && !hasLiveStatement(parseStoredAssessment(existing))) {
		// No statement stands for this source any more: this is a new first creation on the
		// same identity, not a revival of an undone one.
		const candidate = candidateFor(input, operation);
		const patch = {
			initial: { [operation.id]: candidate },
			isDeleted: false,
			lifecycleId: operation.id,
			updatedAt: operation.timestamp
		};
		await transaction.update('intentionAssessments', id, patch);
		const after = normalizeIntentionAssessment({
			...existing,
			...patch,
			initial: { ...(existing.initial as Record<string, unknown>), [operation.id]: candidate }
		});
		await logAssessment(transaction, operation, id, actor, {
			action: 'created',
			patch: { snapshot: { ...existing, ...patch } }
		});
		return after;
	}
	if (existing) {
		// A known withdrawn source is restored, not created again: `initial` stays the record of
		// first creations, so the earliest time and untouched features keep their revisions,
		// while every supplied feature becomes a correction of this operation.
		const before = normalizeIntentionAssessment(existing);
		const overrides = correctionsFor(before, input, operation, false) ?? {};
		const patch = {
			values: overrides,
			isDeleted: false,
			lifecycleId: operation.id,
			updatedAt: operation.timestamp
		};
		await transaction.update('intentionAssessments', id, patch);
		const after = normalizeIntentionAssessment({
			...existing,
			...patch,
			values: { ...storedValues(existing), ...overrides }
		});
		await logAssessment(transaction, operation, id, actor, {
			action: 'restored',
			patch: buildFieldPatches(before, after, assessmentFields)
		});
		return after;
	}
	const candidate = candidateFor(input, operation);
	const row = {
		id,
		source: 'evidence',
		origin: {
			factId: link.fromId,
			intentionId: link.toId,
			evidenceId: link.id,
			activationId
		},
		initial: { [operation.id]: candidate },
		updatedAt: operation.timestamp
	};
	await transaction.insert('intentionAssessments', row);
	await logAssessment(transaction, operation, id, actor, {
		action: 'created',
		patch: { snapshot: row }
	});
	return normalizeIntentionAssessment(row);
};

export const createDirectAssessmentInTransaction = async (
	transaction: Transaction,
	intentionId: string,
	values: IntentionAssessmentValues,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<IntentionAssessment> => {
	const input = parseAssessmentInput(values, true);
	await requireIntention(transaction, intentionId);
	const row = {
		id: createId(),
		source: 'direct',
		origin: { intentionId },
		initial: { [operation.id]: candidateFor(input, operation) },
		updatedAt: operation.timestamp
	};
	await transaction.insert('intentionAssessments', row);
	await logAssessment(transaction, operation, row.id, actor, {
		action: 'created',
		patch: { snapshot: row }
	});
	return normalizeIntentionAssessment(row);
};
