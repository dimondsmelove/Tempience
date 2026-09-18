import { CodedError } from '$lib/model/Errors/CodedError';
import {
	createIntersectionInTransaction,
	setIntersectionDeletedInTransaction
} from '../Intersections/Intersections';
import { now, requireEntity, type Operation } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { createId } from '../ids';
import type { Intersection, LogActor } from '../types';

/**
 * The Kind's direct Scope memberships become exactly `scopeIds`, inside a transaction the
 * caller owns, so a Kind's creation or a new version can carry its memberships in the same
 * commit. An explicit empty set is the accepted «Без Scope»: it also withdraws memberships a
 * Scope deletion hid, so their restore no longer applies; a non-empty set leaves those alone.
 */
export const setTraceKindScopesInTransaction = async (
	transaction: Transaction,
	kindId: string,
	scopeIds: readonly string[],
	actor: LogActor,
	operation: Operation
): Promise<Intersection[]> => {
	await requireEntity(transaction, 'traceKinds', kindId);
	const selected = new Set(scopeIds);
	for (const id of selected) {
		const scope = await requireEntity(transaction, 'scopes', id);
		if (scope.isDeleted) throw new CodedError('scope_missing', 'Выберите существующий Scope.');
	}
	const memberships = (await transaction.fetch('intersections')).filter(
		(row) => row.fromId === kindId && row.kind === 'belongs_to'
	);
	for (const row of memberships) {
		if (
			!selected.has(String(row.toId)) &&
			(!row.isDeleted || (selected.size === 0 && row.scopeDeletionOperationId))
		) {
			await setIntersectionDeletedInTransaction(transaction, row.id, true, actor, operation);
		}
	}
	const result: Intersection[] = [];
	for (const scopeId of selected) {
		result.push(
			await createIntersectionInTransaction(
				transaction,
				{ fromId: kindId, toId: scopeId, kind: 'belongs_to' },
				actor,
				operation
			)
		);
	}
	return result;
};

export const createKindMembershipRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'setTraceKindScopes'> => ({
	setTraceKindScopes: async (kindId, scopeIds, actor = 'user') =>
		client.transact((transaction) =>
			setTraceKindScopesInTransaction(transaction, kindId, scopeIds, actor, {
				id: createId(),
				timestamp: now()
			})
		)
});
