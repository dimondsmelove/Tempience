import { insertLog } from '../Repository/log';
import { newOperation, now, requireEntity, type Operation } from '../Repository/transaction';
import { RepositoryError } from '../Repository/errors';
import { logActionForDeleted } from '../operations';
import type { LogActor, TraceKind } from '../types';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { createId, getDeviceId } from '../ids';
import { buildFieldPatches } from '../operations';
import { assertTraceFormDefinition } from '../trace-kind-v-validation';
import { setTraceKindScopesInTransaction } from './memberships';
import {
	compareTraceKindVersions,
	findTraceKindVersionHeads,
	normalizeParentKindVIds,
	normalizeTraceKind,
	normalizeTraceKindV
} from './read';

const traceKindFields = ['currentKindVId', 'name'] as const;

/** A Kind after its deletion or return, with the operation that wrote it or `null` for none. */
export type TraceKindLifecycleResult = { kind: TraceKind; operation: Operation | null };

/**
 * Deletes a Kind softly or brings it back (owner, 2026-09-29), in the Scope's way: the Kind
 * leaves every choice of a Kind, its versions and records stay; the Log keeps the operation,
 * so the deletion is undone like any other, and a return is refused once another deletion
 * has taken its place.
 */
export const setTraceKindDeletedInTransaction = async (
	transaction: Transaction,
	id: string,
	isDeleted: boolean,
	actor: LogActor,
	operation: Operation = newOperation(),
	expectedDeletionOperationId: string | null = null
): Promise<TraceKindLifecycleResult> => {
	const before = await requireEntity(transaction, 'traceKinds', id);
	if (
		expectedDeletionOperationId !== null &&
		(before.isDeleted !== true || before.deletionOperationId !== expectedDeletionOperationId)
	) {
		throw new RepositoryError('undo_stale', 'Trace Kind изменился после отменяемого удаления.', {
			reason: 'traceKind',
			kindId: id,
			deletionOperationId: before.deletionOperationId ?? null
		});
	}
	if (Boolean(before.isDeleted) === isDeleted) {
		return { kind: normalizeTraceKind(before), operation: null };
	}
	const patch = {
		isDeleted,
		updatedAt: operation.timestamp,
		deletionOperationId: isDeleted ? operation.id : null
	};
	const after = { ...before, ...patch };
	await transaction.update('traceKinds', id, patch);
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'traceKind',
		entityId: id,
		action: logActionForDeleted(isDeleted),
		patch: buildFieldPatches(before, after, ['isDeleted', 'deletionOperationId']),
		actor,
		cause: operation.cause ?? (isDeleted ? 'normal' : 'restore')
	});
	return { kind: normalizeTraceKind(after), operation };
};

export const createKindRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	| 'editTraceKind'
	| 'setTraceKindDeleted'
	| 'ensureTraceKind'
	| 'createTraceKind'
	| 'createTraceKindV'
	| 'listTraceKinds'
	| 'listTraceKindVersions'
	| 'listTraceKindVersionHeads'
> => ({
	setTraceKindDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact((transaction) =>
			setTraceKindDeletedInTransaction(transaction, id, isDeleted, actor)
		),
	// A rename and the memberships the user chose commit together; an untouched selection
	// is not sent, so a Kind a Scope deletion left unscoped keeps its pending restore.
	editTraceKind: async (id, patch, actor = 'user') => {
		const { name, scopeIds } = typeof patch === 'string' ? { name: patch } : patch;
		if (name !== undefined && !name.trim()) throw new Error('TraceKind name is required');
		return client.transact(async (tx) => {
			const before = normalizeTraceKind(await requireEntity(tx, 'traceKinds', id));
			const renamed = name !== undefined && before.name !== name.trim();
			if (!renamed && scopeIds === undefined) return before;
			const operation = { id: createId(), timestamp: now() };
			let after = before;
			if (renamed) {
				after = { ...before, name: name.trim(), updatedAt: operation.timestamp };
				await tx.update('traceKinds', id, { name: after.name, updatedAt: after.updatedAt });
				await insertLog(tx, {
					operationId: operation.id,
					entityType: 'traceKind',
					entityId: id,
					action: 'updated',
					patch: buildFieldPatches(before, after, ['name']),
					actor
				});
			}
			if (scopeIds !== undefined) {
				await setTraceKindScopesInTransaction(tx, id, scopeIds, actor, operation);
			}
			return after;
		});
	},
	ensureTraceKind: async (seed, actor = 'system') => {
		const kindId = seed.id.trim();
		const kindVId = seed.initialKindV.id.trim();
		const name = seed.name.trim();
		if (kindId.length === 0) throw new Error('Seeded TraceKind id is required');
		if (kindVId.length === 0) throw new Error('Seeded TraceKindV id is required');
		if (kindId === kindVId) {
			throw new Error('Seeded TraceKind and TraceKindV ids must be different');
		}
		if (name.length === 0) throw new Error('TraceKind name is required');
		assertTraceFormDefinition(seed.initialKindV);

		return client.transact(async (transaction) => {
			const existingKind = await transaction.fetchById('traceKinds', kindId);
			const existingInitialKindV = await transaction.fetchById('traceKindVersions', kindVId);

			if (existingKind || existingInitialKindV) {
				if (!existingKind || !existingInitialKindV) {
					throw new Error(`Seeded TraceKind ${kindId} is incomplete`);
				}
				const kind = normalizeTraceKind(existingKind);
				const initialKindV = normalizeTraceKindV(existingInitialKindV);
				if (
					kind.name !== name ||
					initialKindV.kindId !== kindId ||
					initialKindV.generation !== 1 ||
					initialKindV.parentKindVIds.length !== 0 ||
					JSON.stringify(initialKindV.dataSchema) !==
						JSON.stringify(seed.initialKindV.dataSchema) ||
					JSON.stringify(initialKindV.uiSchema) !==
						JSON.stringify(seed.initialKindV.uiSchema ?? {}) ||
					JSON.stringify(initialKindV.fieldMeta) !==
						JSON.stringify(seed.initialKindV.fieldMeta ?? {})
				) {
					throw new Error(`Seeded TraceKind ${kindId} conflicts with stored data`);
				}
				const currentKindV = normalizeTraceKindV(
					await requireEntity(transaction, 'traceKindVersions', kind.currentKindVId)
				);
				if (currentKindV.kindId !== kindId) {
					throw new Error(
						`Current TraceKindV ${currentKindV.id} does not belong to TraceKind ${kindId}`
					);
				}
				return { kind, kindV: currentKindV };
			}

			const timestamp = now();
			const operationId = createId();
			const kindRow = {
				id: kindId,
				name,
				currentKindVId: kindVId,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			const kindVRow = {
				id: kindVId,
				kindId,
				generation: 1,
				parentKindVIds: [] as string[],
				dataSchema: seed.initialKindV.dataSchema,
				uiSchema: seed.initialKindV.uiSchema ?? {},
				fieldMeta: seed.initialKindV.fieldMeta ?? {},
				createdAt: timestamp,
				createdByDeviceId: getDeviceId()
			};
			await transaction.insert('traceKinds', kindRow);
			await transaction.insert('traceKindVersions', kindVRow);
			await insertLog(transaction, {
				operationId,
				entityType: 'traceKind',
				entityId: kindId,
				action: 'created',
				patch: { snapshot: kindRow },
				actor
			});
			await insertLog(transaction, {
				operationId,
				entityType: 'traceKindV',
				entityId: kindVId,
				action: 'created',
				patch: { snapshot: kindVRow },
				actor
			});
			return {
				kind: normalizeTraceKind(kindRow),
				kindV: normalizeTraceKindV(kindVRow)
			};
		});
	},
	createTraceKind: async (draft, actor = 'user') => {
		const name = draft.name.trim();
		if (name.length === 0) throw new Error('TraceKind name is required');
		assertTraceFormDefinition(draft.initialKindV);

		return client.transact(async (transaction) => {
			const timestamp = now();
			const operationId = createId();
			const kindId = createId();
			const kindVId = createId();
			const kindRow = {
				id: kindId,
				name,
				currentKindVId: kindVId,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			const kindVRow = {
				id: kindVId,
				kindId,
				generation: 1,
				parentKindVIds: [] as string[],
				dataSchema: draft.initialKindV.dataSchema,
				uiSchema: draft.initialKindV.uiSchema ?? {},
				fieldMeta: draft.initialKindV.fieldMeta ?? {},
				createdAt: timestamp,
				createdByDeviceId: getDeviceId()
			};
			await transaction.insert('traceKinds', kindRow);
			await transaction.insert('traceKindVersions', kindVRow);
			await insertLog(transaction, {
				operationId,
				entityType: 'traceKind',
				entityId: kindId,
				action: 'created',
				patch: { snapshot: kindRow },
				actor
			});
			await insertLog(transaction, {
				operationId,
				entityType: 'traceKindV',
				entityId: kindVId,
				action: 'created',
				patch: { snapshot: kindVRow },
				actor
			});
			// The chosen memberships belong to the same commit: a refused Scope creates no Kind.
			if (draft.scopeIds) {
				await setTraceKindScopesInTransaction(transaction, kindId, draft.scopeIds, actor, {
					id: operationId,
					timestamp
				});
			}
			return {
				kind: normalizeTraceKind(kindRow),
				kindV: normalizeTraceKindV(kindVRow)
			};
		});
	},
	createTraceKindV: async (kindId, draft, actor = 'user') => {
		assertTraceFormDefinition(draft);
		if (draft.kindName !== undefined && !draft.kindName.trim())
			throw new Error('TraceKind name is required');

		return client.transact(async (transaction) => {
			const kind = await requireEntity(transaction, 'traceKinds', kindId);
			const parentKindVIds = normalizeParentKindVIds(
				draft.parentKindVIds ?? [String(kind.currentKindVId)]
			);
			if (parentKindVIds.length === 0) {
				throw new Error('A new TraceKindV must have at least one parent');
			}
			const parentKindVersions = await Promise.all(
				parentKindVIds.map(async (parentKindVId) =>
					normalizeTraceKindV(await requireEntity(transaction, 'traceKindVersions', parentKindVId))
				)
			);
			for (const parentKindV of parentKindVersions) {
				if (parentKindV.kindId !== kindId) {
					throw new Error(`TraceKindV ${parentKindV.id} does not belong to TraceKind ${kindId}`);
				}
			}
			const timestamp = now();
			const operationId = createId();
			const kindVRow = {
				id: createId(),
				kindId,
				generation: Math.max(...parentKindVersions.map((kindV) => kindV.generation)) + 1,
				parentKindVIds,
				dataSchema: draft.dataSchema,
				uiSchema: draft.uiSchema ?? {},
				fieldMeta: draft.fieldMeta ?? {},
				createdAt: timestamp,
				createdByDeviceId: getDeviceId()
			};
			const updatedKind = {
				...kind,
				name: draft.kindName?.trim() ?? kind.name,
				currentKindVId: kindVRow.id,
				updatedAt: timestamp
			};
			await transaction.insert('traceKindVersions', kindVRow);
			await transaction.update('traceKinds', kindId, {
				name: updatedKind.name,
				currentKindVId: kindVRow.id,
				updatedAt: timestamp
			});
			await insertLog(transaction, {
				operationId,
				entityType: 'traceKindV',
				entityId: kindVRow.id,
				action: 'created',
				patch: { snapshot: kindVRow },
				actor
			});
			await insertLog(transaction, {
				operationId,
				entityType: 'traceKind',
				entityId: kindId,
				action: 'updated',
				patch: buildFieldPatches(kind, updatedKind, traceKindFields),
				actor
			});
			if (draft.scopeIds) {
				await setTraceKindScopesInTransaction(transaction, kindId, draft.scopeIds, actor, {
					id: operationId,
					timestamp
				});
			}
			return normalizeTraceKindV(kindVRow);
		});
	},
	listTraceKinds: async () => {
		const values = await client.fetch('traceKinds');
		return values.map(normalizeTraceKind).toSorted((a, b) => a.name.localeCompare(b.name));
	},
	listTraceKindVersions: async (kindId) => {
		const values = await client.fetch('traceKindVersions');
		return values
			.map(normalizeTraceKindV)
			.filter((kindV) => kindId === undefined || kindV.kindId === kindId)
			.toSorted(compareTraceKindVersions);
	},
	listTraceKindVersionHeads: async (kindId) => {
		const values = await client.fetch('traceKindVersions');
		return findTraceKindVersionHeads(
			values.map(normalizeTraceKindV).filter((kindV) => kindV.kindId === kindId)
		);
	}
});
