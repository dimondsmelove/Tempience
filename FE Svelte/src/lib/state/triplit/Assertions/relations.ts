import { insertLog } from '../Repository/log';
import { now, requireActiveEntity, requireEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import { normalizeAssertion } from './read';
import {
	assertionRelationFields,
	normalizeAssertionRelation,
	upsertAssertionRelationInTransaction
} from './relation-write';
import { correctAssertionInTransaction } from './review';

export const createAssertionRelationRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	'createAssertionRelation' | 'setAssertionRelationDeleted' | 'listAssertionRelations'
> => ({
	createAssertionRelation: async (draft, actor = 'user') =>
		client.transact(async (transaction) => {
			if (draft.kind === 'corrects') {
				return (
					await correctAssertionInTransaction(
						transaction,
						draft.toAssertionId,
						draft.fromAssertionId,
						actor
					)
				).relation;
			}
			return upsertAssertionRelationInTransaction(transaction, draft, actor);
		}),
	setAssertionRelationDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeAssertionRelation(
				await requireEntity(transaction, 'assertionRelations', id)
			);
			if (before.isDeleted === isDeleted) return before;
			if (isDeleted && before.kind === 'corrects') {
				const corrected = normalizeAssertion(
					await requireEntity(transaction, 'assertions', before.toAssertionId)
				);
				if (corrected.reviewStatus === 'corrected') {
					const relations = await transaction.fetch('assertionRelations');
					const hasAnotherReplacement = relations.some(
						(relation) =>
							relation.id !== before.id &&
							relation.kind === 'corrects' &&
							relation.toAssertionId === before.toAssertionId &&
							!relation.isDeleted
					);
					if (!hasAnotherReplacement) {
						throw new Error('A corrected Assertion must keep an active replacement relation');
					}
				}
			}
			if (!isDeleted) {
				await requireActiveEntity(transaction, 'assertions', before.fromAssertionId);
				await requireActiveEntity(transaction, 'assertions', before.toAssertionId);
			}
			const after = { ...before, isDeleted, updatedAt: now() };
			await transaction.update('assertionRelations', id, {
				isDeleted,
				updatedAt: after.updatedAt
			});
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'assertionRelation',
				entityId: id,
				action: isDeleted ? 'unlinked' : 'linked',
				patch: buildFieldPatches(before, after, assertionRelationFields),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return after;
		}),
	listAssertionRelations: async (includeDeleted = false) => {
		const values = await client.fetch('assertionRelations');
		return values
			.map(normalizeAssertionRelation)
			.filter((relation) => includeDeleted || !relation.isDeleted)
			.toSorted(
				(left, right) =>
					left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
			);
	}
});
