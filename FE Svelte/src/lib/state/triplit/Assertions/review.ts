import { insertLog } from '../Repository/log';
import { now, requireActiveEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import type { Assertion, AssertionRelation, AssertionReviewStatus, LogActor } from '../types';
import { assertionFields } from './Assertions';
import { normalizeAssertion } from './read';
import { upsertAssertionRelationInTransaction } from './relation-write';

const setAssertionReviewStatusInTransaction = async (
	transaction: Transaction,
	before: Assertion,
	status: AssertionReviewStatus,
	actor: LogActor,
	operationId = createId()
): Promise<Assertion> => {
	if (before.reviewStatus === status) return before;
	const timestamp = now();
	const after = {
		...before,
		reviewStatus: status,
		reviewedAt: before.reviewedAt ?? timestamp,
		updatedAt: timestamp
	};
	await transaction.update('assertions', before.id, {
		reviewStatus: after.reviewStatus,
		reviewedAt: after.reviewedAt,
		updatedAt: after.updatedAt
	});
	await insertLog(transaction, {
		operationId,
		entityType: 'assertion',
		entityId: before.id,
		action: 'updated',
		patch: buildFieldPatches(before, after, assertionFields),
		actor
	});
	return after;
};

export const correctAssertionInTransaction = async (
	transaction: Transaction,
	correctedAssertionId: string,
	replacementAssertionId: string,
	actor: LogActor
): Promise<{ corrected: Assertion; relation: AssertionRelation }> => {
	if (correctedAssertionId === replacementAssertionId) {
		throw new Error('An Assertion cannot correct itself');
	}
	const before = normalizeAssertion(
		await requireActiveEntity(transaction, 'assertions', correctedAssertionId)
	);
	await requireActiveEntity(transaction, 'assertions', replacementAssertionId);
	if (before.reviewStatus !== 'unreviewed' && before.reviewStatus !== 'accepted') {
		throw new Error(
			`Assertion ${correctedAssertionId} must be unreviewed or accepted before correction`
		);
	}
	const operationId = createId();
	const relation = await upsertAssertionRelationInTransaction(
		transaction,
		{
			fromAssertionId: replacementAssertionId,
			toAssertionId: correctedAssertionId,
			kind: 'corrects'
		},
		actor,
		operationId
	);
	const corrected = await setAssertionReviewStatusInTransaction(
		transaction,
		before,
		'corrected',
		actor,
		operationId
	);
	return { corrected, relation };
};

export const createAssertionReviewRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'reviewAssertion' | 'reopenAssertionReview' | 'correctAssertion'> => ({
	reviewAssertion: async (id, status, actor = 'user') =>
		client.transact(async (transaction) => {
			if (status !== 'accepted' && status !== 'rejected') {
				throw new Error('Assertion review decision must be accepted or rejected');
			}
			const before = normalizeAssertion(await requireActiveEntity(transaction, 'assertions', id));
			if (before.reviewStatus === status) return before;
			const allowed =
				before.reviewStatus === 'unreviewed' ||
				(before.reviewStatus === 'accepted' && status === 'rejected');
			if (!allowed) {
				throw new Error(
					`Assertion ${id} must be reopened before changing ${before.reviewStatus} to ${status}`
				);
			}
			return setAssertionReviewStatusInTransaction(transaction, before, status, actor);
		}),
	reopenAssertionReview: async (id, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeAssertion(await requireActiveEntity(transaction, 'assertions', id));
			if (before.reviewStatus === 'unreviewed') return before;
			return setAssertionReviewStatusInTransaction(transaction, before, 'unreviewed', actor);
		}),
	correctAssertion: async (correctedAssertionId, replacementAssertionId, actor = 'user') =>
		client.transact((transaction) =>
			correctAssertionInTransaction(
				transaction,
				correctedAssertionId,
				replacementAssertionId,
				actor
			)
		)
});
