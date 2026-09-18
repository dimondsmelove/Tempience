import { insertLog } from '../Repository/log';
import { now, requireActiveEntity, tupleId } from '../Repository/transaction';
import type { Transaction } from '../Repository/types';
import { entityId, enumValue } from '../Repository/validation';
import { createId } from '../ids';
import { buildFieldPatches } from '../operations';
import type {
	AssertionRelation,
	AssertionRelationDraft,
	AssertionRelationKind,
	LogActor
} from '../types';

export const assertionRelationFields = ['isDeleted'] as const;

const assertionRelationKinds = [
	'corrects',
	'conflicts_with'
] as const satisfies readonly AssertionRelationKind[];

export const normalizeAssertionRelation = (value: Record<string, unknown>): AssertionRelation => ({
	id: String(value.id),
	fromAssertionId: String(value.fromAssertionId),
	toAssertionId: String(value.toAssertionId),
	kind: enumValue(value.kind, assertionRelationKinds, 'Stored AssertionRelation kind'),
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

const canonicalAssertionRelationDraft = (draft: AssertionRelationDraft): AssertionRelationDraft =>
	draft.kind === 'conflicts_with' && draft.fromAssertionId.localeCompare(draft.toAssertionId) > 0
		? {
				...draft,
				fromAssertionId: draft.toAssertionId,
				toAssertionId: draft.fromAssertionId
			}
		: draft;

const assertionRelationIdFor = (draft: AssertionRelationDraft): string =>
	tupleId('assertion-relation', [draft.fromAssertionId, draft.toAssertionId, draft.kind]);

export const upsertAssertionRelationInTransaction = async (
	transaction: Transaction,
	draft: AssertionRelationDraft,
	actor: LogActor,
	operationId = createId()
): Promise<AssertionRelation> => {
	const kind = enumValue(draft.kind, assertionRelationKinds, 'AssertionRelation kind');
	const canonicalDraft = canonicalAssertionRelationDraft({
		fromAssertionId: entityId(draft.fromAssertionId, 'AssertionRelation fromAssertionId'),
		toAssertionId: entityId(draft.toAssertionId, 'AssertionRelation toAssertionId'),
		kind
	});
	if (canonicalDraft.fromAssertionId === canonicalDraft.toAssertionId) {
		throw new Error('AssertionRelation endpoints must be different');
	}
	await requireActiveEntity(transaction, 'assertions', canonicalDraft.fromAssertionId);
	await requireActiveEntity(transaction, 'assertions', canonicalDraft.toAssertionId);
	const id = assertionRelationIdFor(canonicalDraft);
	const existing = await transaction.fetchById('assertionRelations', id);
	if (existing && !existing.isDeleted) return normalizeAssertionRelation(existing);
	const timestamp = now();
	const row = {
		id,
		...canonicalDraft,
		isDeleted: false,
		createdAt: typeof existing?.createdAt === 'string' ? existing.createdAt : timestamp,
		updatedAt: timestamp
	};
	if (existing) await transaction.update('assertionRelations', id, row);
	else await transaction.insert('assertionRelations', row);
	await insertLog(transaction, {
		operationId,
		entityType: 'assertionRelation',
		entityId: id,
		action: 'linked',
		patch: existing ? buildFieldPatches(existing, row, assertionRelationFields) : { snapshot: row },
		actor,
		cause: existing ? 'restore' : 'normal'
	});
	return normalizeAssertionRelation(row);
};
