import { createIntersectionInTransaction } from '../Intersections/Intersections';
import { insertLog } from '../Repository/log';
import { now, requireEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import { inspectScopeHierarchyIntegrity } from '../scope-hierarchy-integrity';
import type { Intersection, LogActor } from '../types';
import {
	assertChildOfActivation,
	assertCurrentScopeHierarchyIntegrity,
	scopeHierarchySnapshotInTransaction
} from './hierarchy-validation';

export const setScopeParentInTransaction = async (
	transaction: Transaction,
	childScopeId: string,
	parentScopeId: string | null,
	context: string | null | undefined,
	actor: LogActor
): Promise<Intersection | null> => {
	await requireEntity(transaction, 'scopes', childScopeId);
	await assertCurrentScopeHierarchyIntegrity(transaction);
	const intersections = await transaction.fetch('intersections');
	const activeParents = intersections.filter(
		(value) => value.fromId === childScopeId && value.kind === 'child_of' && !value.isDeleted
	);
	if (parentScopeId === null) {
		for (const value of activeParents) {
			const after = { ...value, isDeleted: true, updatedAt: now() };
			await transaction.update('intersections', value.id, {
				isDeleted: true,
				updatedAt: after.updatedAt
			});
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'intersection',
				entityId: value.id,
				action: 'unlinked',
				patch: buildFieldPatches(value, after, ['isDeleted']),
				actor
			});
		}
		return null;
	}

	await assertChildOfActivation(transaction, childScopeId, parentScopeId, 'replace');
	for (const value of activeParents) {
		if (value.toId === parentScopeId) continue;
		const after = { ...value, isDeleted: true, updatedAt: now() };
		await transaction.update('intersections', value.id, {
			isDeleted: true,
			updatedAt: after.updatedAt
		});
		await insertLog(transaction, {
			operationId: createId(),
			entityType: 'intersection',
			entityId: value.id,
			action: 'unlinked',
			patch: buildFieldPatches(value, after, ['isDeleted']),
			actor
		});
	}
	return createIntersectionInTransaction(
		transaction,
		{ fromId: childScopeId, toId: parentScopeId, kind: 'child_of', context },
		actor
	);
};

export const createScopeHierarchyRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	| 'setScopeParent'
	| 'auditScopeHierarchyIntegrity'
	| 'linkScopeToScope'
	| 'migrateLegacyScopeParents'
> => ({
	setScopeParent: async (childScopeId, parentScopeId, context = null, actor = 'user') =>
		client.transact((transaction) =>
			setScopeParentInTransaction(transaction, childScopeId, parentScopeId, context, actor)
		),
	auditScopeHierarchyIntegrity: async () =>
		client.transact(async (transaction) => {
			const snapshot = await scopeHierarchySnapshotInTransaction(transaction);
			return inspectScopeHierarchyIntegrity(snapshot.scopes, snapshot.intersections);
		}),
	linkScopeToScope: async (
		childScopeId,
		parentScopeId,
		kind = 'child_of',
		context = null,
		actor = 'user'
	) =>
		client.transact(async (transaction) => {
			await requireEntity(transaction, 'scopes', childScopeId);
			await requireEntity(transaction, 'scopes', parentScopeId);
			if (kind === 'child_of') {
				return setScopeParentInTransaction(
					transaction,
					childScopeId,
					parentScopeId,
					context,
					actor
				).then((intersection) => {
					if (!intersection) throw new Error('Scope parent link was not created');
					return intersection;
				});
			}
			return createIntersectionInTransaction(
				transaction,
				{ fromId: childScopeId, toId: parentScopeId, kind, context },
				actor
			);
		}),
	migrateLegacyScopeParents: async (actor = 'system') =>
		client.transact(async (transaction) => {
			const scopes = await transaction.fetch('scopes');
			const intersections = await transaction.fetch('intersections');
			let migrated = 0;
			for (const scope of scopes) {
				const parentScopeId = typeof scope.parentScopeId === 'string' ? scope.parentScopeId : null;
				if (!parentScopeId) continue;
				const alreadyMigrated = intersections.some(
					(intersection) =>
						intersection.fromId === scope.id &&
						intersection.toId === parentScopeId &&
						intersection.kind === 'child_of' &&
						!intersection.isDeleted
				);
				if (alreadyMigrated) continue;
				await setScopeParentInTransaction(transaction, scope.id, parentScopeId, null, actor);
				const cleared = { ...scope, parentScopeId: null, updatedAt: now() };
				await transaction.update('scopes', scope.id, {
					parentScopeId: null,
					updatedAt: cleared.updatedAt
				});
				await insertLog(transaction, {
					operationId: createId(),
					entityType: 'scope',
					entityId: scope.id,
					action: 'updated',
					patch: buildFieldPatches(scope, cleared, ['parentScopeId']),
					actor,
					cause: 'import'
				});
				migrated += 1;
			}
			return migrated;
		})
});
