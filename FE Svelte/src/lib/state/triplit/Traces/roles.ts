import { RepositoryError } from '../Repository/errors';
import type { Transaction } from '../Repository/types';

/**
 * Roles follow the existing classification: only `relation === 'intend'` is an intention;
 * `actual`, legacy relations and an absent relation all read as a fact. Historical rows
 * are never reclassified here.
 */
export const isIntentionRelation = (relation: unknown): boolean => relation === 'intend';

export type RelationBlock = {
	linkId: string;
	endpointId: string;
	direction: 'outgoing' | 'incoming';
};

/**
 * A saved Trace may change its relation unless an active evidence_for link would lose its
 * fact -> intention roles: a fact with outgoing evidence cannot become an intention and an
 * intention with incoming evidence cannot become a fact. Scope, part_of and revisits never
 * block; the blocking link is reported so the user can unlink it explicitly.
 */
export const findRelationBlock = async (
	transaction: Transaction,
	traceId: string,
	becomesIntention: boolean
): Promise<RelationBlock | null> => {
	for (const row of await transaction.fetch('intersections')) {
		if (row.kind !== 'evidence_for' || row.isDeleted === true) continue;
		if (becomesIntention && row.fromId === traceId) {
			return { linkId: String(row.id), endpointId: String(row.toId), direction: 'outgoing' };
		}
		if (!becomesIntention && row.toId === traceId) {
			return { linkId: String(row.id), endpointId: String(row.fromId), direction: 'incoming' };
		}
	}
	return null;
};

export const assertRelationChangeAllowed = async (
	transaction: Transaction,
	traceId: string,
	before: unknown,
	after: unknown
): Promise<void> => {
	const becomesIntention = isIntentionRelation(after);
	if (becomesIntention === isIntentionRelation(before)) return;
	const block = await findRelationBlock(transaction, traceId, becomesIntention);
	if (block) {
		throw new RepositoryError(
			'relation_blocked',
			becomesIntention
				? 'Запись остаётся фактом, пока она связана как результат намерения: сначала снимите связь.'
				: 'Запись остаётся намерением, пока у неё есть результаты: сначала снимите связь.',
			{ reason: becomesIntention ? 'intention' : 'fact', ...block }
		);
	}
};
