import { setIntersectionDeletedInTransaction } from '../Intersections/Intersections';
import { RepositoryError } from '../Repository/errors';
import { insertLog } from '../Repository/log';
import { newOperation, now, requireEntity, type Operation } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository, Transaction } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import type { LogActor, Scope } from '../types';
import { setScopeParentInTransaction } from './hierarchy';
import { legacySlotHue } from './legacy-colour';

const scopeFields = [
	'name',
	'note',
	'startedAt',
	'endedAt',
	'colorHue',
	'colorChroma',
	'colorDepth',
	'colorSlot'
] as const;

/** A stored hue as the Scope carries it: an integer degree on the circle, or none. */
const storedHue = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value)
		? ((Math.round(value) % 360) + 360) % 360
		: null;
/** A stored saturation: an integer 0–100, or the default (`null`). */
const storedChroma = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value)
		? Math.max(0, Math.min(100, Math.round(value)))
		: null;
/** A stored depth: an integer 0–2, or unsaid (`null`, read as 0) — every Scope stored before C6. */
const storedDepth = (value: unknown): number | null => {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	const depth = Math.round(value);
	return depth >= 0 && depth <= 2 ? depth : null;
};
/**
 * The colour of a stored row: its hue when a build of R1 wrote one (`null` included — that
 * is a chosen «без цвета»), else the hue of the loop-005 slot the row may still carry.
 */
export const storedScopeHue = (row: Record<string, unknown>): number | null =>
	row.colorHue !== undefined && row.colorHue !== null
		? storedHue(row.colorHue)
		: row.colorHue === null
			? null
			: legacySlotHue(row.colorSlot);

export const normalizeScope = (value: Record<string, unknown>): Scope => ({
	id: String(value.id),
	name: String(value.name),
	note: (value.note as string | null | undefined) ?? null,
	parentScopeId: (value.parentScopeId as string | null | undefined) ?? null,
	startedAt: (value.startedAt as string | null | undefined) ?? null,
	endedAt: (value.endedAt as string | null | undefined) ?? null,
	colorHue: storedScopeHue(value),
	colorChroma: storedChroma(value.colorChroma),
	colorDepth: storedDepth(value.colorDepth),
	isDeleted: Boolean(value.isDeleted),
	deletionOperationId: (value.deletionOperationId as string | null | undefined) ?? null,
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

/**
 * Deletes a Scope with the Kind memberships it hides, stamping each with this deletion, or
 * restores it with only the memberships that still carry that deletion's provenance. An
 * inverse names the deletion it compensates and refuses any other current deletion.
 */
/** A Scope after its deletion or return, with the operation that wrote it or `null` for none. */
export type ScopeLifecycleResult = { scope: Scope; operation: Operation | null };

export const setScopeDeletedInTransaction = async (
	transaction: Transaction,
	id: string,
	isDeleted: boolean,
	actor: LogActor,
	operation: Operation = newOperation(),
	expectedDeletionOperationId: string | null = null
): Promise<ScopeLifecycleResult> => {
	const before = await requireEntity(transaction, 'scopes', id);
	if (
		expectedDeletionOperationId !== null &&
		(before.isDeleted !== true || before.deletionOperationId !== expectedDeletionOperationId)
	) {
		throw new RepositoryError('undo_stale', 'Scope изменился после отменяемого удаления.', {
			reason: 'scope',
			scopeId: id,
			deletionOperationId: before.deletionOperationId ?? null
		});
	}
	if (Boolean(before.isDeleted) === isDeleted) {
		return { scope: normalizeScope(before), operation: null };
	}
	const patch = {
		isDeleted,
		updatedAt: operation.timestamp,
		deletionOperationId: isDeleted ? operation.id : null
	};
	const after = { ...before, ...patch };
	await transaction.update('scopes', id, patch);
	const memberships = (await transaction.fetch('intersections')).filter(
		(row) => row.fromEntityType === 'traceKind' && row.kind === 'belongs_to' && row.toId === id
	);
	for (const row of memberships) {
		if (
			isDeleted
				? !row.isDeleted
				: row.isDeleted &&
					before.deletionOperationId &&
					row.scopeDeletionOperationId === before.deletionOperationId
		) {
			await setIntersectionDeletedInTransaction(
				transaction,
				row.id,
				isDeleted,
				actor,
				operation,
				isDeleted ? operation.id : null
			);
		}
	}
	await insertLog(transaction, {
		operationId: operation.id,
		occurredAt: operation.timestamp,
		entityType: 'scope',
		entityId: id,
		action: logActionForDeleted(isDeleted),
		patch: buildFieldPatches(before, after, ['isDeleted', 'deletionOperationId']),
		actor,
		cause: operation.cause ?? (isDeleted ? 'normal' : 'restore')
	});
	return { scope: normalizeScope(after), operation };
};

export const createScopeRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'createScope' | 'editScope' | 'setScopeDeleted' | 'listScopes'> => ({
	createScope: async (draft, actor = 'user') =>
		client.transact(async (transaction) => {
			const timestamp = now();
			const id = createId();
			const row = {
				id,
				name: draft.name,
				note: draft.note ?? null,
				// Kept null for legacy schema compatibility; hierarchy is an Intersection.
				parentScopeId: null,
				startedAt: draft.startedAt ?? null,
				endedAt: draft.endedAt ?? null,
				colorHue: draft.colorHue ?? null,
				colorChroma: draft.colorChroma ?? null,
				colorDepth: draft.colorDepth ?? null,
				isDeleted: false,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await transaction.insert('scopes', row);
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'scope',
				entityId: id,
				action: 'created',
				patch: { snapshot: row },
				actor
			});
			if (draft.parentScopeId) {
				await setScopeParentInTransaction(transaction, id, draft.parentScopeId, null, actor);
			}
			return normalizeScope(row);
		}),
	editScope: async (id, patch, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = await requireEntity(transaction, 'scopes', id);
			const hasParentPatch = Object.hasOwn(patch, 'parentScopeId');
			const parentScopeId = patch.parentScopeId ?? null;
			const scopePatch: Record<string, unknown> = { ...patch };
			delete scopePatch.parentScopeId;
			// A colour save writes the hue and retires the loop-005 slot with it, so the stored row
			// says one thing and the read-time fallback never revives a colour the owner cleared.
			if (Object.hasOwn(patch, 'colorHue') && before.colorSlot != null) scopePatch.colorSlot = null;
			const after = {
				...before,
				...scopePatch,
				...(hasParentPatch ? { parentScopeId: null } : {}),
				updatedAt: now()
			};
			const fieldPatches = {
				...buildFieldPatches(before, after, scopeFields),
				...(hasParentPatch && !Object.is(before.parentScopeId, after.parentScopeId)
					? { parentScopeId: { before: before.parentScopeId ?? null, after: null } }
					: {})
			};
			if (Object.keys(fieldPatches).length > 0) {
				await transaction.update('scopes', id, {
					...scopePatch,
					...(hasParentPatch ? { parentScopeId: null } : {}),
					updatedAt: after.updatedAt
				});
				await insertLog(transaction, {
					operationId: createId(),
					entityType: 'scope',
					entityId: id,
					action: 'updated',
					patch: fieldPatches,
					actor
				});
			}
			if (hasParentPatch) {
				await setScopeParentInTransaction(transaction, id, parentScopeId, null, actor);
			}
			return normalizeScope(after);
		}),
	setScopeDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact((transaction) =>
			setScopeDeletedInTransaction(transaction, id, isDeleted, actor)
		),
	listScopes: async (includeDeleted = false) => {
		const values = await client.fetch('scopes');
		return values
			.map(normalizeScope)
			.filter((scope) => includeDeleted || !scope.isDeleted)
			.toSorted((a, b) => a.name.localeCompare(b.name));
	}
});
