import { CodedError } from '$lib/model/Errors/CodedError';
import { insertLog } from '../Repository/log';
import { newOperation, requireEntity, type Operation } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { assertChildOfActivation } from '../Scopes/hierarchy-validation';
import { assertEvidenceEndpoints } from './evidence';
import { assertRevisitsActivation, assertRevisitsWithdrawal } from './revisits';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import type { Intersection, IntersectionDraft, IntersectionPatch, LogActor } from '../types';
import {
	byNewestUpdated,
	canonicalIntersectionDraft,
	intersectionIdFor,
	normalizeContext,
	normalizeIntersection
} from './read';

const intersectionFields = ['fromId', 'toId', 'kind', 'context', 'isDeleted'] as const;

const assertTraceCompositionLink = async (
	transaction: Transaction,
	partTraceId: string,
	wholeTraceId: string
): Promise<void> => {
	if (partTraceId === wholeTraceId) throw new Error('Trace cannot be part of itself');
	await requireEntity(transaction, 'traces', partTraceId);
	await requireEntity(transaction, 'traces', wholeTraceId);

	const intersections = await transaction.fetch('intersections');
	const parentIdsByPartId = new Map<string, string[]>();
	for (const value of intersections) {
		if (value.kind !== 'part_of' || value.isDeleted) continue;
		const partId = String(value.fromId);
		const parentIds = parentIdsByPartId.get(partId);
		if (parentIds) parentIds.push(String(value.toId));
		else parentIdsByPartId.set(partId, [String(value.toId)]);
	}

	const pending = [wholeTraceId];
	const visited = new Set<string>();
	while (pending.length > 0) {
		const current = pending.pop();
		if (current === undefined || visited.has(current)) continue;
		if (current === partTraceId) {
			throw new Error('Trace composition cannot contain a cycle');
		}
		visited.add(current);
		pending.push(...(parentIdsByPartId.get(current) ?? []));
	}
};

export const createIntersectionInTransaction = async (
	transaction: Transaction,
	draft: IntersectionDraft,
	actor: LogActor,
	operation: Operation = newOperation(),
	/** Internal to the retarget helper: the source it transfers onto this evidence activation. */
	binding: { assessmentId: string | null } = { assessmentId: null }
): Promise<Intersection> => {
	const canonicalDraft = canonicalIntersectionDraft(draft);
	const fromKind =
		canonicalDraft.kind === 'belongs_to'
			? await transaction.fetchById('traceKinds', canonicalDraft.fromId)
			: null;
	if (fromKind) {
		const scope = await requireEntity(transaction, 'scopes', canonicalDraft.toId);
		if (scope.isDeleted) throw new CodedError('scope_missing', 'Выберите существующий Scope.');
	}
	if (canonicalDraft.kind === 'evidence_for') {
		await assertEvidenceEndpoints(transaction, canonicalDraft.fromId, canonicalDraft.toId);
	}
	if (canonicalDraft.kind === 'revisits') {
		await assertRevisitsActivation(transaction, canonicalDraft.fromId, canonicalDraft.toId, null);
	}
	if (canonicalDraft.kind === 'part_of') {
		await assertTraceCompositionLink(transaction, canonicalDraft.fromId, canonicalDraft.toId);
	} else if (canonicalDraft.fromId === canonicalDraft.toId) {
		if (canonicalDraft.kind === 'child_of') throw new Error('Scope cannot be its own parent');
		throw new Error('Intersection endpoints must be different');
	} else if (canonicalDraft.kind === 'child_of') {
		await assertChildOfActivation(transaction, canonicalDraft.fromId, canonicalDraft.toId, 'add');
	}
	const id = intersectionIdFor(canonicalDraft.fromId, canonicalDraft.toId, canonicalDraft.kind);
	const existing = await transaction.fetchById('intersections', id);
	if (existing && !existing.isDeleted) return normalizeIntersection(existing);
	const timestamp = operation.timestamp;
	const row = {
		id,
		fromId: canonicalDraft.fromId,
		toId: canonicalDraft.toId,
		kind: canonicalDraft.kind,
		context: normalizeContext(canonicalDraft.context),
		...(fromKind ? { fromEntityType: 'traceKind' } : {}),
		// Each activation is its own identity: several links of one operation must not share it.
		activationId: createId(),
		lifecycleId: operation.id,
		scopeDeletionOperationId: null,
		// A fresh activation carries only the binding the caller transfers; a relink clears it.
		...(canonicalDraft.kind === 'evidence_for' ? { assessmentId: binding.assessmentId } : {}),
		isDeleted: false,
		createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : timestamp,
		updatedAt: timestamp
	};
	if (existing) {
		const { id: intersectionId, ...patch } = row;
		await transaction.update('intersections', intersectionId, patch);
	} else {
		await transaction.insert('intersections', row);
	}
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: timestamp,
		entityType: 'intersection',
		entityId: id,
		action: 'linked',
		patch: { snapshot: row },
		actor
	});
	return normalizeIntersection(row);
};

const editIntersectionInTransaction = async (
	transaction: Transaction,
	id: string,
	patch: IntersectionPatch,
	actor: LogActor,
	operation: Operation = newOperation()
): Promise<Intersection> => {
	const before = await requireEntity(transaction, 'intersections', id);
	const after = {
		...before,
		context: normalizeContext(patch.context),
		updatedAt: operation.timestamp
	};
	const fieldPatches = buildFieldPatches(before, after, intersectionFields);
	if (Object.keys(fieldPatches).length === 0) return normalizeIntersection(before);
	await transaction.update('intersections', id, {
		context: after.context,
		updatedAt: after.updatedAt
	});
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'intersection',
		entityId: id,
		action: 'updated',
		patch: fieldPatches,
		actor
	});
	return normalizeIntersection(after);
};

/**
 * One withdrawal or return of a link and the operation that wrote it; `null` when the link
 * already stood as asked and nothing was written, so nothing can be offered back for it.
 */
export type IntersectionLifecycleResult = { link: Intersection; operation: Operation | null };

export const setIntersectionDeletedInTransaction = async (
	transaction: Transaction,
	id: string,
	isDeleted: boolean,
	actor: LogActor,
	operation: Operation = newOperation(),
	scopeDeletionOperationId: string | null = null
): Promise<IntersectionLifecycleResult> => {
	const before = await requireEntity(transaction, 'intersections', id);
	if (!isDeleted && before.fromEntityType === 'traceKind') {
		await requireEntity(transaction, 'traceKinds', String(before.fromId));
		const scope = await requireEntity(transaction, 'scopes', String(before.toId));
		if (scope.isDeleted) throw new CodedError('scope_missing', 'Выберите существующий Scope.');
	}
	if (!isDeleted && before.kind === 'child_of') {
		await assertChildOfActivation(transaction, String(before.fromId), String(before.toId), 'add');
	}
	if (!isDeleted && before.kind === 'evidence_for') {
		await assertEvidenceEndpoints(transaction, String(before.fromId), String(before.toId));
	}
	if (before.kind === 'revisits' && Boolean(before.isDeleted) !== isDeleted) {
		if (isDeleted) await assertRevisitsWithdrawal(transaction, String(before.fromId), id);
		else
			await assertRevisitsActivation(transaction, String(before.fromId), String(before.toId), id);
	}
	if (
		Boolean(before.isDeleted) === isDeleted &&
		(before.scopeDeletionOperationId ?? null) === scopeDeletionOperationId
	) {
		return { link: normalizeIntersection(before), operation: null };
	}
	if (!isDeleted && before.kind === 'part_of') {
		await assertTraceCompositionLink(transaction, String(before.fromId), String(before.toId));
	}
	const patch = {
		isDeleted,
		updatedAt: operation.timestamp,
		lifecycleId: operation.id,
		scopeDeletionOperationId
	};
	const after = { ...before, ...patch };
	await transaction.update('intersections', id, patch);
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'intersection',
		entityId: id,
		action: logActionForDeleted(isDeleted),
		patch: buildFieldPatches(before, after, [
			'isDeleted',
			'lifecycleId',
			'scopeDeletionOperationId'
		]),
		actor,
		cause: operation.cause ?? (isDeleted ? 'normal' : 'restore')
	});
	return { link: normalizeIntersection(after), operation };
};

export const createIntersectionRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	| 'createIntersection'
	| 'editIntersection'
	| 'setIntersectionDeleted'
	| 'linkTraceToTrace'
	| 'linkTraceToScope'
	| 'listIntersections'
> => ({
	createIntersection: async (draft, actor = 'user') =>
		client.transact((transaction) => createIntersectionInTransaction(transaction, draft, actor)),
	editIntersection: async (id, patch, actor = 'user') =>
		client.transact((transaction) => editIntersectionInTransaction(transaction, id, patch, actor)),
	setIntersectionDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact((transaction) =>
			setIntersectionDeletedInTransaction(transaction, id, isDeleted, actor)
		),
	linkTraceToTrace: async (
		fromTraceId,
		toTraceId,
		kind = 'evidence_for',
		context = null,
		actor = 'user'
	) =>
		client.transact(async (transaction) => {
			await requireEntity(transaction, 'traces', fromTraceId);
			await requireEntity(transaction, 'traces', toTraceId);
			return createIntersectionInTransaction(
				transaction,
				{ fromId: fromTraceId, toId: toTraceId, kind, context },
				actor
			);
		}),
	linkTraceToScope: async (traceId, scopeId, kind = 'belongs_to', context = null, actor = 'user') =>
		client.transact(async (transaction) => {
			await requireEntity(transaction, 'traces', traceId);
			await requireEntity(transaction, 'scopes', scopeId);
			return createIntersectionInTransaction(
				transaction,
				{ fromId: traceId, toId: scopeId, kind, context },
				actor
			);
		}),
	listIntersections: async (includeDeleted = false) => {
		const values = await client.fetch('intersections');
		return values
			.map(normalizeIntersection)
			.filter((intersection) => includeDeleted || !intersection.isDeleted)
			.toSorted(byNewestUpdated);
	}
});
