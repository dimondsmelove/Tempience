import { insertLog } from '../Repository/log';
import { now, requireActiveEntity, requireEntity } from '../Repository/transaction';
import type { RepositoryClient, TraceRepository } from '../Repository/types';
import { enumValue, nullableText, requiredText } from '../Repository/validation';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import type { AssertionPatch } from '../types';
import { assertionConfidences, assertionEpistemicLayers, normalizeAssertion } from './read';

export const assertionFields = [
	'statement',
	'epistemicLayer',
	'confidence',
	'reviewStatus',
	'reviewedAt',
	'note'
] as const;

export const createAssertionRepository = (
	client: RepositoryClient
): Pick<
	TraceRepository,
	'createAssertion' | 'editAssertion' | 'setAssertionDeleted' | 'listAssertions'
> => ({
	createAssertion: async (draft, actor = 'user') => {
		const statement = requiredText(draft.statement, 'Assertion statement');
		const epistemicLayer = enumValue(
			draft.epistemicLayer,
			assertionEpistemicLayers,
			'Assertion epistemicLayer'
		);
		const confidence = enumValue(draft.confidence, assertionConfidences, 'Assertion confidence');
		const note = nullableText(draft.note, 'Assertion note');
		return client.transact(async (transaction) => {
			const timestamp = now();
			const row = {
				id: createId(),
				statement,
				epistemicLayer,
				confidence,
				reviewStatus: 'unreviewed' as const,
				reviewedAt: null,
				note,
				isDeleted: false,
				createdAt: timestamp,
				updatedAt: timestamp
			};
			await transaction.insert('assertions', row);
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'assertion',
				entityId: row.id,
				action: 'created',
				patch: { snapshot: row },
				actor
			});
			return normalizeAssertion(row);
		});
	},
	editAssertion: async (id, patch, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeAssertion(await requireActiveEntity(transaction, 'assertions', id));
			const requested: AssertionPatch = {};
			if (Object.hasOwn(patch, 'statement')) {
				requested.statement = requiredText(patch.statement, 'Assertion statement');
			}
			if (Object.hasOwn(patch, 'epistemicLayer')) {
				requested.epistemicLayer = enumValue(
					patch.epistemicLayer,
					assertionEpistemicLayers,
					'Assertion epistemicLayer'
				);
			}
			if (Object.hasOwn(patch, 'confidence')) {
				requested.confidence = enumValue(
					patch.confidence,
					assertionConfidences,
					'Assertion confidence'
				);
			}
			if (Object.hasOwn(patch, 'note')) {
				requested.note = nullableText(patch.note, 'Assertion note');
			}
			if (before.reviewedAt !== null) {
				for (const field of ['statement', 'epistemicLayer', 'confidence'] as const) {
					if (Object.hasOwn(requested, field) && !Object.is(before[field], requested[field])) {
						throw new Error(`Assertion ${field} is locked after the first completed review`);
					}
				}
			}
			const after = { ...before, ...requested, updatedAt: now() };
			const fieldPatches = buildFieldPatches(before, after, assertionFields);
			if (Object.keys(fieldPatches).length === 0) return before;
			await transaction.update('assertions', id, { ...requested, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'assertion',
				entityId: id,
				action: 'updated',
				patch: fieldPatches,
				actor
			});
			return after;
		}),
	setAssertionDeleted: async (id, isDeleted, actor = 'user') =>
		client.transact(async (transaction) => {
			const before = normalizeAssertion(await requireEntity(transaction, 'assertions', id));
			if (before.isDeleted === isDeleted) return before;
			const after = { ...before, isDeleted, updatedAt: now() };
			await transaction.update('assertions', id, { isDeleted, updatedAt: after.updatedAt });
			await insertLog(transaction, {
				operationId: createId(),
				entityType: 'assertion',
				entityId: id,
				action: logActionForDeleted(isDeleted),
				patch: buildFieldPatches(before, after, ['isDeleted']),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return after;
		}),
	listAssertions: async (includeDeleted = false) => {
		const values = await client.fetch('assertions');
		return values
			.map(normalizeAssertion)
			.filter((assertion) => includeDeleted || !assertion.isDeleted)
			.toSorted(
				(left, right) =>
					right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)
			);
	}
});
