import { intersectionIdFor } from '../Intersections/read';
import { requireEntity } from '../Repository/transaction';
import type { Transaction } from '../Repository/types';
import {
	assertScopeHierarchyIntegrity,
	inspectScopeHierarchyIntegrity
} from '../scope-hierarchy-integrity';

export const scopeHierarchySnapshotInTransaction = async (transaction: Transaction) => {
	const scopes = await transaction.fetch('scopes');
	const intersections = await transaction.fetch('intersections');
	return {
		// Soft-deleted Scopes remain graph endpoints so their links survive a later restore.
		scopes: scopes.map((scope) => ({ id: String(scope.id) })),
		intersections: intersections.map((intersection) => ({
			id: String(intersection.id),
			fromId: String(intersection.fromId),
			toId: String(intersection.toId),
			kind: String(intersection.kind),
			isDeleted: Boolean(intersection.isDeleted)
		}))
	};
};

export const assertCurrentScopeHierarchyIntegrity = async (
	transaction: Transaction
): Promise<void> => {
	const snapshot = await scopeHierarchySnapshotInTransaction(transaction);
	assertScopeHierarchyIntegrity(
		inspectScopeHierarchyIntegrity(snapshot.scopes, snapshot.intersections)
	);
};

export const assertChildOfActivation = async (
	transaction: Transaction,
	childScopeId: string,
	parentScopeId: string,
	mode: 'add' | 'replace'
): Promise<void> => {
	if (childScopeId === parentScopeId) throw new Error('Scope cannot be its own parent');
	await requireEntity(transaction, 'scopes', childScopeId);
	await requireEntity(transaction, 'scopes', parentScopeId);

	const snapshot = await scopeHierarchySnapshotInTransaction(transaction);
	assertScopeHierarchyIntegrity(
		inspectScopeHierarchyIntegrity(snapshot.scopes, snapshot.intersections)
	);

	const proposedId = intersectionIdFor(childScopeId, parentScopeId, 'child_of');
	const proposedIntersections = snapshot.intersections
		.filter((intersection) => intersection.id !== proposedId)
		.map((intersection) =>
			mode === 'replace' &&
			intersection.kind === 'child_of' &&
			!intersection.isDeleted &&
			intersection.fromId === childScopeId
				? { ...intersection, isDeleted: true }
				: intersection
		);
	proposedIntersections.push({
		id: proposedId,
		fromId: childScopeId,
		toId: parentScopeId,
		kind: 'child_of',
		isDeleted: false
	});
	assertScopeHierarchyIntegrity(
		inspectScopeHierarchyIntegrity(snapshot.scopes, proposedIntersections)
	);
};
