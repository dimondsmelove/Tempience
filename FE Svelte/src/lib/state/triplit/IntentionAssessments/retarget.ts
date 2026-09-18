import {
	createIntersectionInTransaction,
	setIntersectionDeletedInTransaction
} from '../Intersections/Intersections';
import { assertEvidenceEndpoints } from '../Intersections/evidence';
import {
	intersectionActivationId,
	intersectionIdFor,
	normalizeIntersection
} from '../Intersections/read';
import { insertLog } from '../Repository/log';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { buildFieldPatches } from '../operations';
import type { Intersection, LogActor } from '../types';
import { assessmentFields } from './IntentionAssessments';
import { linkSourceId, resolveLinkSource } from './binding';
import { refuse } from './input';
import { normalizeIntentionAssessment } from './read';
import type { IntentionAssessment } from './types';

export type EvidenceRetarget = {
	link: Intersection;
	/** The transferred source, or null when the corrected link carried no own assessment. */
	assessment: IntentionAssessment | null;
	/**
	 * The operation that committed this correction, as the caller needs it to name it; `null`
	 * when the link already pointed where asked and nothing was written.
	 */
	operation: Operation | null;
};

/**
 * Corrects one current evidence link F->A to F->B as one operation: the old link is
 * withdrawn, F->B is activated with a fresh activation bound to the transferred source,
 * and that source keeps its identity, first creations, corrections and original first time
 * while its placement moves with a revision that names this operation. A previously
 * withdrawn F->B keeps its own historical source detached. P2: an active F->B refuses the
 * whole operation before any write.
 */
export const correctEvidenceTargetInTransaction = async (
	transaction: Transaction,
	evidenceId: string,
	intentionId: string,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<EvidenceRetarget> => {
	const currentRow = await requireEntity(transaction, 'intersections', evidenceId);
	if (currentRow.kind !== 'evidence_for') {
		refuse('evidence_kind', 'Исправить адресата можно только у связи «результат для».', {
			reason: 'retarget'
		});
	}
	if (currentRow.isDeleted === true) {
		refuse(
			'evidence_inactive',
			'Связь снята: исправить адресата можно только у действующей связи.',
			{
				reason: 'retarget'
			}
		);
	}
	const current = normalizeIntersection(currentRow);
	const sourceRow = await transaction.fetchById('intentionAssessments', linkSourceId(current));
	const resolved = resolveLinkSource(current, sourceRow);
	if (resolved.status === 'unavailable') {
		refuse('source_unavailable', 'Перенесённая оценка этой связи недоступна; повторите позже.', {
			linkId: current.id,
			assessmentId: resolved.assessmentId
		});
	}
	if (resolved.status === 'detached') {
		refuse(
			'source_detached',
			'Эта связь ссылается на оценку, которая теперь принадлежит другой связи: действуйте через актуальную связь.',
			{
				linkId: current.id,
				assessmentId: resolved.assessment.id,
				currentEvidenceId: resolved.assessment.evidenceId
			}
		);
	}
	// Only the link's own active source travels; a withdrawn one stays as history at its place.
	const source = resolved.status === 'current' ? sourceRow : null;
	if (current.toId === intentionId) {
		return {
			link: current,
			assessment: source ? normalizeIntentionAssessment(source) : null,
			operation: null
		};
	}
	await assertEvidenceEndpoints(transaction, current.fromId, intentionId);
	const targetId = intersectionIdFor(current.fromId, intentionId, 'evidence_for');
	const targetRow = await transaction.fetchById('intersections', targetId);
	if (targetRow && targetRow.isDeleted !== true) {
		refuse(
			'target_linked',
			'У этого факта уже есть действующая связь с выбранным намерением: исправьте существующие связи по отдельности.',
			{ linkId: targetId }
		);
	}

	await setIntersectionDeletedInTransaction(transaction, current.id, true, actor, operation);
	const link = await createIntersectionInTransaction(
		transaction,
		{ fromId: current.fromId, toId: intentionId, kind: 'evidence_for' },
		actor,
		operation,
		{ assessmentId: source ? String(source.id) : null }
	);
	if (!source) return { link, assessment: null, operation };

	const before = normalizeIntentionAssessment(source);
	const patch = {
		placement: {
			intentionId,
			evidenceId: link.id,
			activationId: intersectionActivationId(link),
			operationId: operation.id
		},
		lifecycleId: operation.id,
		updatedAt: operation.timestamp
	};
	await transaction.update('intentionAssessments', String(source.id), patch);
	const after = normalizeIntentionAssessment({ ...source, ...patch });
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'intentionAssessment',
		entityId: after.id,
		action: 'updated',
		patch: buildFieldPatches(before, after, assessmentFields),
		actor
	});
	return { link, assessment: after, operation };
};

export const createEvidenceRetargetRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'correctEvidenceTarget'> => ({
	correctEvidenceTarget: async (evidenceId, intentionId, actor = 'user') => {
		await client.ready?.();
		return client.transact((transaction) =>
			correctEvidenceTargetInTransaction(transaction, evidenceId, intentionId, actor)
		);
	}
});
