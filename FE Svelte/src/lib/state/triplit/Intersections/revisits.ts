import { RepositoryError } from '../Repository/errors';
import type { Transaction } from '../Repository/types';
import { activeRevisitsFrom, isActiveStoredSupplement } from '../Traces/supplement';

/**
 * P4 for the new supplement marker: exactly one active revisits link. Activating a second
 * one (creation, relink or restore) is refused; historical generic revisits of ordinary
 * records are not governed. Both endpoints must exist; the original may be deleted.
 */
export const assertRevisitsActivation = async (
	transaction: Transaction,
	fromId: string,
	toId: string,
	linkId: string | null
): Promise<void> => {
	if (fromId === toId) throw new Error('Intersection endpoints must be different');
	const supplement = await transaction.fetchById('traces', fromId);
	if (!supplement) throw new Error(`traces entity not found: ${fromId}`);
	if (!(await transaction.fetchById('traces', toId))) {
		throw new Error(`traces entity not found: ${toId}`);
	}
	if (!(await isActiveStoredSupplement(transaction, fromId))) return;
	// The same original again is the idempotent existing link, not a second one.
	const others = activeRevisitsFrom(await transaction.fetch('intersections'), fromId).filter(
		(row) => row.id !== linkId && String(row.toId) !== toId
	);
	if (others.length > 0) {
		throw new RepositoryError(
			'supplement_cardinality',
			'У дополнения может быть только один оригинал.',
			{
				traceId: fromId,
				linkIds: others.map((row) => String(row.id))
			}
		);
	}
};

/** Withdrawing the last revisits link would leave an active supplement without its original. */
export const assertRevisitsWithdrawal = async (
	transaction: Transaction,
	fromId: string,
	linkId: string
): Promise<void> => {
	if (!(await isActiveStoredSupplement(transaction, fromId))) return;
	const remaining = activeRevisitsFrom(await transaction.fetch('intersections'), fromId).filter(
		(row) => row.id !== linkId
	);
	if (remaining.length === 0) {
		throw new RepositoryError(
			'supplement_orphan',
			'Дополнение должно относиться к одной существующей записи: снимите само дополнение, а не его связь.',
			{ reason: 'link', traceId: fromId, linkId }
		);
	}
};
