import { insertLog } from '../Repository/log';
import { now, requireActiveEntity, requireEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository } from '../Repository/types';
import { enumValue, nullableIsoTimestamp, requiredText } from '../Repository/validation';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import type { Source, SourceKind, SourcePatch } from '../types';

const sourceFields = ['title', 'kind', 'capturedAt'] as const;

const sourceKinds = [
	'voice_recollection',
	'note',
	'calendar',
	'message',
	'other'
] as const satisfies readonly SourceKind[];

export const normalizeSource = (value: Record<string, unknown>): Source => ({
	id: String(value.id),
	title: requiredText(value.title, 'Stored Source title'),
	kind: enumValue(value.kind, sourceKinds, 'Stored Source kind'),
	content: typeof value.content === 'string' ? value.content : String(value.content),
	capturedAt: nullableIsoTimestamp(value.capturedAt, 'Stored Source capturedAt'),
	isDeleted: Boolean(value.isDeleted),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

const sourceContent = (value: unknown): string => {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error('Source content is required');
	}
	return value;
};

export const createSourceRepository = (
	client: RepositoryClient
): Pick<TraceRepository, 'createSource' | 'editSource' | 'setSourceDeleted' | 'listSources'> => ({
	createSource: async (draft, actor = 'user') => {
		const title = requiredText(draft.title, 'Source title');
		const kind = enumValue(draft.kind, sourceKinds, 'Source kind');
		const content = sourceContent(draft.content);
		const capturedAt = nullableIsoTimestamp(draft.capturedAt, 'Source capturedAt');
		return client.transact(async (transaction) => {
			const timestamp = now();
			const row = {
				id: createId(),
				title,
				kind,
				content,
				capturedAt,
				isDeleted: false,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await transaction.insert('sources', row);
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'source',
				entityId: row.id,
				action: 'created',
				patch: { snapshot: row },
				actor
			});
			return normalizeSource(row);
		});
	},
	editSource: async (id, patch, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeSource(await requireActiveEntity(transaction, 'sources', id));
			const requested: SourcePatch = {};
			if (Object.hasOwn(patch, 'title')) {
				requested.title = requiredText(patch.title, 'Source title');
			}
			if (Object.hasOwn(patch, 'kind')) {
				requested.kind = enumValue(patch.kind, sourceKinds, 'Source kind');
			}
			if (Object.hasOwn(patch, 'capturedAt')) {
				requested.capturedAt = nullableIsoTimestamp(patch.capturedAt, 'Source capturedAt');
			}
			const after = { ...before, ...requested, updatedAt: now() };
			const fieldPatches = buildFieldPatches(before, after, sourceFields);
			if (Object.keys(fieldPatches).length === 0) return before;
			await transaction.update('sources', id, { ...requested, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'source',
				entityId: id,
				action: 'updated',
				patch: fieldPatches,
				actor
			});
			return after;
		}),
	setSourceDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeSource(await requireEntity(transaction, 'sources', id));
			if (before.isDeleted === isDeleted) return before;
			const after = { ...before, isDeleted, updatedAt: now() };
			await transaction.update('sources', id, { isDeleted, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'source',
				entityId: id,
				action: logActionForDeleted(isDeleted),
				patch: buildFieldPatches(before, after, ['isDeleted']),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return after;
		}),
	listSources: async (includeDeleted = false) => {
		const values = await client.fetch('sources');
		return values
			.map(normalizeSource)
			.filter((source) => includeDeleted || !source.isDeleted)
			.toSorted(
				(left, right) =>
					right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id)
			);
	}
});
