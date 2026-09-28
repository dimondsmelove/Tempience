import { insertLog } from '../Repository/log';
import { newOperation } from '../Repository/transaction';
import type { RepositoryClient } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import type { LogActor } from '../types';
import { keepHiddenEntries, lineupInput } from './lineup';
import { normalizeChapterStageRow, readRows, stageOf } from './read';
import type { ChapterRepository } from './types';
import {
	assertStageInChapter,
	instantOf,
	lifecyclePatch,
	nameOf,
	noteOf,
	requireChapter,
	requireStage,
	sameJson
} from './validation';

const STAGE_FIELDS = ['name', 'note', 'startedAt', 'lineup'] as const;

/** A chapter's stages: created inside a chapter that is not deleted, edited, deleted on their own. */
export const createChapterStageRepository = (
	client: RepositoryClient
): Pick<
	ChapterRepository,
	'createChapterStage' | 'editChapterStage' | 'setChapterStageDeleted'
> => ({
	createChapterStage: async (chapterId, draft, actor = 'user') => {
		const row = {
			chapterId,
			name: nameOf(draft.name, 'Stage name'),
			note: noteOf(draft.note, 'Stage note'),
			startedAt: instantOf(draft.start, 'Stage start'),
			lineup:
				draft.lineup === null || draft.lineup === undefined
					? null
					: lineupInput(draft.lineup, 'Stage lineup')
		};
		await client.ready?.();
		return client.transact(async (transaction) => {
			assertStageInChapter(row.startedAt, await requireChapter(transaction, chapterId));
			const operation = newOperation();
			const id = createId();
			const stored = {
				id,
				...row,
				isDeleted: false,
				createdAt: operation.timestamp,
				updatedAt: operation.timestamp
			};
			await transaction.insert('chapterStages', stored);
			await insertLog(transaction, {
				operationId: operation.id,
				occurredAt: operation.timestamp,
				entityType: 'chapterStage',
				entityId: id,
				action: 'created',
				patch: { snapshot: stored },
				actor
			});
			const { deletedScopeIds } = await readRows(transaction.fetch);
			return stageOf(normalizeChapterStageRow(stored), deletedScopeIds);
		});
	},
	editChapterStage: async (id, patch, actor = 'user') => {
		await client.ready?.();
		return client.transact(async (transaction) => {
			const before = normalizeChapterStageRow(await requireStage(transaction, id));
			const { deletedScopeIds } = await readRows(transaction.fetch);
			const requested: Record<string, unknown> = {};
			if (Object.hasOwn(patch, 'name')) requested.name = nameOf(patch.name, 'Stage name');
			if (Object.hasOwn(patch, 'note')) requested.note = noteOf(patch.note, 'Stage note');
			if (Object.hasOwn(patch, 'start')) {
				requested.startedAt = instantOf(patch.start, 'Stage start');
				assertStageInChapter(
					requested.startedAt as string,
					await requireChapter(transaction, before.chapterId)
				);
			}
			if (Object.hasOwn(patch, 'lineup')) {
				const lineup =
					patch.lineup === null || patch.lineup === undefined
						? null
						: keepHiddenEntries(
								before.lineup ?? [],
								lineupInput(patch.lineup, 'Stage lineup'),
								deletedScopeIds
							);
				if (!sameJson(lineup, before.lineup)) requested.lineup = lineup;
			}
			const after = { ...before, ...requested } as typeof before;
			const fieldPatches = buildFieldPatches({ ...before }, after, STAGE_FIELDS);
			if (Object.keys(fieldPatches).length === 0) return stageOf(before, deletedScopeIds);
			const operation = newOperation();
			const changed = Object.fromEntries(
				Object.keys(fieldPatches).map((field) => [field, requested[field]])
			);
			await transaction.update('chapterStages', id, { ...changed, updatedAt: operation.timestamp });
			await insertLog(transaction, {
				operationId: operation.id,
				occurredAt: operation.timestamp,
				entityType: 'chapterStage',
				entityId: id,
				action: 'updated',
				patch: fieldPatches,
				actor
			});
			return stageOf({ ...after, updatedAt: operation.timestamp }, deletedScopeIds);
		});
	},
	setChapterStageDeleted: async (id, isDeleted, actor: LogActor = 'user') => {
		await client.ready?.();
		return client.transact(async (transaction) => {
			const before = normalizeChapterStageRow(await requireStage(transaction, id, true));
			const { deletedScopeIds } = await readRows(transaction.fetch);
			if (before.isDeleted === isDeleted)
				return {
					stage: stageOf(before, deletedScopeIds),
					chapterId: before.chapterId,
					isDeleted,
					operation: null
				};
			if (!isDeleted) await requireChapter(transaction, before.chapterId);
			const operation = newOperation();
			const patch = lifecyclePatch(isDeleted, operation);
			await transaction.update('chapterStages', id, patch);
			await insertLog(transaction, {
				operationId: operation.id,
				occurredAt: operation.timestamp,
				entityType: 'chapterStage',
				entityId: id,
				action: logActionForDeleted(isDeleted),
				patch: buildFieldPatches({ ...before }, { ...before, ...patch }, [
					'isDeleted',
					'deletionOperationId'
				]),
				actor,
				cause: isDeleted ? 'normal' : 'restore'
			});
			return {
				stage: stageOf(before, deletedScopeIds),
				chapterId: before.chapterId,
				isDeleted,
				operation
			};
		});
	}
});
