import { ms } from '$lib/model/Chapters';
import { insertLog } from '../Repository/log';
import { RepositoryError } from '../Repository/errors';
import { newOperation } from '../Repository/transaction';
import type { RepositoryClient } from '../Repository/types';
import { createId } from '../ids';
import { buildFieldPatches, logActionForDeleted } from '../operations';
import { keepHiddenEntries, lineupInput } from './lineup';
import {
	assembleChapters,
	normalizeChapterRow,
	normalizeChapterStageRow,
	readChapter,
	readRows,
	type ChapterRow,
	type ChapterStageRow
} from './read';
import { createChapterStageRepository } from './stages';
import type { ChapterRepository } from './types';
import {
	colourOf,
	instantOf,
	lifecyclePatch,
	nameOf,
	noteOf,
	requireChapter,
	sameJson
} from './validation';

const CHAPTER_FIELDS = [
	'name',
	'note',
	'colorHue',
	'colorChroma',
	'colorDepth',
	'startedAt',
	'closedAt',
	'lineup'
] as const;

/**
 * The stages a chapter's new start carries along: the one that started with the chapter moves
 * with it; any other active stage that would start before the new start refuses the move.
 */
const stagesAtNewStart = (
	stages: readonly ChapterStageRow[],
	chapter: ChapterRow,
	start: string
): ChapterStageRow[] => {
	const own = stages.filter((stage) => stage.chapterId === chapter.id && !stage.isDeleted);
	const old = ms(chapter.startedAt);
	const early = own
		.filter((stage) => ms(stage.startedAt) !== old && ms(stage.startedAt) < ms(start))
		.toSorted((a, b) => ms(a.startedAt) - ms(b.startedAt))[0];
	if (early)
		throw new RepositoryError(
			'chapter_invalid',
			`Stage ${early.id} would start before the chapter's new start`,
			{ reason: 'stages', name: early.name, stageId: early.id }
		);
	return own.filter((stage) => ms(stage.startedAt) === old);
};

/**
 * An explicit end comes after the chapter's start, and — when it is written — not after the
 * next chapter's start: a chapter never runs over the one after it. A close written earlier
 * survives a chapter inserted inside it later (the derived end follows the newcomer).
 */
const assertClose = (
	rows: readonly ChapterRow[],
	ownId: string | null,
	start: string,
	closedAt: string | null,
	written: boolean
): void => {
	if (closedAt === null) return;
	if (ms(closedAt) <= ms(start))
		throw new RepositoryError('chapter_invalid', 'A chapter ends after it starts', {
			reason: 'close'
		});
	if (!written) return;
	const next = rows
		.filter((row) => !row.isDeleted && row.id !== ownId && ms(row.startedAt) > ms(start))
		.toSorted((a, b) => ms(a.startedAt) - ms(b.startedAt))[0];
	if (next && ms(closedAt) > ms(next.startedAt))
		throw new RepositoryError('chapter_invalid', 'A chapter ends after the next one starts', {
			reason: 'closeAfterNext',
			name: next.name,
			chapterId: next.id
		});
};

/** Two chapters never start at the same moment: a chapter's window would be empty. */
const assertFreeStart = (
	rows: readonly ChapterRow[],
	start: string,
	ownId: string | null
): void => {
	const at = ms(start);
	if (rows.some((row) => !row.isDeleted && row.id !== ownId && ms(row.startedAt) === at))
		throw new RepositoryError('chapter_clash', 'A chapter already starts at this moment', {
			startedAt: start
		});
};

export const createChapterRepository = (client: RepositoryClient): ChapterRepository => ({
	listChapters: async () => {
		await client.ready?.();
		const rows = await readRows(client.fetch);
		return assembleChapters(rows.chapters, rows.stages, rows.deletedScopeIds);
	},
	createChapter: async (draft, actor = 'user') => {
		const name = nameOf(draft.name, 'Chapter name');
		const startedAt = instantOf(draft.start, 'Chapter start');
		const closedAt =
			draft.closedAt === null || draft.closedAt === undefined
				? null
				: instantOf(draft.closedAt, 'Chapter close');
		const row = {
			name,
			note: noteOf(draft.note, 'Chapter note'),
			colorHue: colourOf(draft.colorHue, 'Chapter hue'),
			colorChroma: colourOf(draft.colorChroma, 'Chapter chroma'),
			colorDepth: colourOf(draft.colorDepth, 'Chapter depth'),
			startedAt,
			closedAt,
			lineup: lineupInput(draft.lineup ?? [])
		};
		await client.ready?.();
		return client.transact(async (transaction) => {
			const rows = (await transaction.fetch('chapters')).map(normalizeChapterRow);
			assertFreeStart(rows, startedAt, null);
			assertClose(rows, null, startedAt, closedAt, true);
			const operation = newOperation();
			const id = createId();
			const stored = {
				id,
				...row,
				isDeleted: false,
				createdAt: operation.timestamp,
				updatedAt: operation.timestamp
			};
			await transaction.insert('chapters', stored);
			await insertLog(transaction, {
				operationId: operation.id,
				occurredAt: operation.timestamp,
				entityType: 'chapter',
				entityId: id,
				action: 'created',
				patch: { snapshot: stored },
				actor
			});
			return readChapter(transaction, id);
		});
	},
	editChapter: async (id, patch, actor = 'user') => {
		await client.ready?.();
		return client.transact(async (transaction) => {
			const before = normalizeChapterRow(await requireChapter(transaction, id));
			const requested: Record<string, unknown> = {};
			if (Object.hasOwn(patch, 'name')) requested.name = nameOf(patch.name, 'Chapter name');
			if (Object.hasOwn(patch, 'note')) requested.note = noteOf(patch.note, 'Chapter note');
			for (const [field, label] of [
				['colorHue', 'Chapter hue'],
				['colorChroma', 'Chapter chroma'],
				['colorDepth', 'Chapter depth']
			] as const)
				if (Object.hasOwn(patch, field)) requested[field] = colourOf(patch[field], label);
			/** Stages that started with the chapter: they move with its start. */
			let following: ChapterStageRow[] = [];
			if (Object.hasOwn(patch, 'start')) {
				requested.startedAt = instantOf(patch.start, 'Chapter start');
				if (requested.startedAt !== before.startedAt) {
					assertFreeStart(
						(await transaction.fetch('chapters')).map(normalizeChapterRow),
						requested.startedAt as string,
						id
					);
					following = stagesAtNewStart(
						(await transaction.fetch('chapterStages')).map(normalizeChapterStageRow),
						before,
						requested.startedAt as string
					);
				}
			}
			if (Object.hasOwn(patch, 'closedAt'))
				requested.closedAt =
					patch.closedAt === null || patch.closedAt === undefined
						? null
						: instantOf(patch.closedAt, 'Chapter close');
			if (Object.hasOwn(patch, 'lineup')) {
				const { deletedScopeIds } = await readRows(transaction.fetch);
				const lineup = keepHiddenEntries(
					before.lineup,
					lineupInput(patch.lineup ?? []),
					deletedScopeIds
				);
				if (!sameJson(lineup, before.lineup)) requested.lineup = lineup;
			}
			const after = { ...before, ...requested };
			if (Object.hasOwn(requested, 'startedAt') || Object.hasOwn(requested, 'closedAt'))
				assertClose(
					(await transaction.fetch('chapters')).map(normalizeChapterRow),
					id,
					after.startedAt,
					after.closedAt,
					Object.hasOwn(requested, 'closedAt') && requested.closedAt !== before.closedAt
				);
			const fieldPatches = buildFieldPatches({ ...before }, after, CHAPTER_FIELDS);
			if (Object.keys(fieldPatches).length === 0) return readChapter(transaction, id);
			const operation = newOperation();
			const changed = Object.fromEntries(
				Object.keys(fieldPatches).map((field) => [field, requested[field]])
			);
			await transaction.update('chapters', id, { ...changed, updatedAt: operation.timestamp });
			for (const stage of following) {
				const moved = { startedAt: requested.startedAt, updatedAt: operation.timestamp };
				await transaction.update('chapterStages', stage.id, moved);
				await insertLog(transaction, {
					operationId: operation.id,
					occurredAt: operation.timestamp,
					entityType: 'chapterStage',
					entityId: stage.id,
					action: 'updated',
					patch: buildFieldPatches({ ...stage }, { ...stage, ...moved }, ['startedAt']),
					actor
				});
			}
			await insertLog(transaction, {
				operationId: operation.id,
				occurredAt: operation.timestamp,
				entityType: 'chapter',
				entityId: id,
				action: 'updated',
				patch: fieldPatches,
				actor
			});
			return readChapter(transaction, id);
		});
	},
	setChapterDeleted: async (id, isDeleted, actor = 'user') => {
		await client.ready?.();
		return client.transact(async (transaction) => {
			const before = normalizeChapterRow(await requireChapter(transaction, id, true));
			if (before.isDeleted === isDeleted)
				return { chapter: await readChapter(transaction, id), isDeleted, operation: null };
			if (!isDeleted)
				assertFreeStart(
					(await transaction.fetch('chapters')).map(normalizeChapterRow),
					before.startedAt,
					id
				);
			const operation = newOperation();
			const cause = operation.cause ?? (isDeleted ? 'normal' : 'restore');
			const patch = lifecyclePatch(isDeleted, operation);
			await transaction.update('chapters', id, patch);
			await insertLog(transaction, {
				operationId: operation.id,
				occurredAt: operation.timestamp,
				entityType: 'chapter',
				entityId: id,
				action: logActionForDeleted(isDeleted),
				patch: buildFieldPatches({ ...before }, { ...before, ...patch }, [
					'isDeleted',
					'deletionOperationId'
				]),
				actor,
				cause
			});
			// The stages go with the chapter, stamped with this deletion; a return brings back
			// only those — a stage deleted on its own before stays deleted.
			const stages = (await transaction.fetch('chapterStages'))
				.map(normalizeChapterStageRow)
				.filter((stage) => stage.chapterId === id)
				.filter((stage) =>
					isDeleted
						? !stage.isDeleted
						: stage.isDeleted &&
							before.deletionOperationId !== null &&
							stage.deletionOperationId === before.deletionOperationId
				);
			for (const stage of stages) {
				await transaction.update('chapterStages', stage.id, patch);
				await insertLog(transaction, {
					operationId: operation.id,
					occurredAt: operation.timestamp,
					entityType: 'chapterStage',
					entityId: stage.id,
					action: logActionForDeleted(isDeleted),
					patch: buildFieldPatches({ ...stage }, { ...stage, ...patch }, [
						'isDeleted',
						'deletionOperationId'
					]),
					actor,
					cause
				});
			}
			return { chapter: await readChapter(transaction, id), isDeleted, operation };
		});
	},
	...createChapterStageRepository(client)
});
