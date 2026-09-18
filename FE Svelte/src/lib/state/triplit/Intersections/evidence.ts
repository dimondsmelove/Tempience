import { RepositoryError } from '../Repository/errors';
import type { Entity, Transaction } from '../Repository/types';
import { isIntentionRelation } from '../Traces/roles';

/**
 * Every activation of an evidence_for link — creation, relink, restore, retarget — goes
 * through this check: both endpoints exist and are active, they differ, and the roles are
 * fact -> intention. A fact needs no event date to be linked; only an explicit assessment
 * does. Missing endpoints are refused here and read as unavailable elsewhere, never repaired.
 */
export const assertEvidenceEndpoints = async (
	transaction: Transaction,
	factId: string,
	intentionId: string
): Promise<{ fact: Entity; intention: Entity }> => {
	if (factId === intentionId) {
		throw new RepositoryError(
			'evidence_endpoint',
			'Факт и намерение должны быть разными записями.',
			{
				reason: 'same'
			}
		);
	}
	const fact = await transaction.fetchById('traces', factId);
	const intention = await transaction.fetchById('traces', intentionId);
	if (!fact || !intention) {
		throw new RepositoryError('evidence_endpoint', 'Связанная запись недоступна.', {
			reason: 'unavailable',
			missingId: !fact ? factId : intentionId
		});
	}
	if (fact.isDeleted === true || intention.isDeleted === true) {
		throw new RepositoryError('evidence_endpoint', 'Связанная запись удалена.', {
			reason: 'deleted',
			deletedId: fact.isDeleted === true ? factId : intentionId
		});
	}
	if (isIntentionRelation(fact.relation)) {
		throw new RepositoryError(
			'fact_role',
			'Источником результата должен быть факт, а не намерение.',
			{
				traceId: factId
			}
		);
	}
	if (!isIntentionRelation(intention.relation)) {
		throw new RepositoryError('intention_role', 'Адресатом результата должно быть намерение.', {
			traceId: intentionId
		});
	}
	return { fact, intention };
};
