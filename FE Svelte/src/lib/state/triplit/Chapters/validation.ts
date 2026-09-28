import { ms } from '$lib/model/Chapters';
import { RepositoryError } from '../Repository/errors';
import type { Operation } from '../Repository/transaction';
import type { Entity, Transaction } from '../Repository/types';

/** What of a chapter or a stage cannot be written: the `reason` picks the sentence the user reads. */
export type InvalidReason = 'name' | 'instant' | 'note' | 'colour' | 'lineup';

/** A field of a chapter or a stage refused, with the field's label for the log. */
export const invalid = (reason: InvalidReason, message: string): RepositoryError =>
	new RepositoryError('chapter_invalid', message, { reason });

/** A chapter to write under: present, and not deleted unless `deleted` allows it. */
export const requireChapter = async (
	transaction: Transaction,
	id: string,
	deleted = false
): Promise<Entity> => {
	const row = await transaction.fetchById('chapters', id);
	if (!row) throw new RepositoryError('chapter_missing', `Chapter not found: ${id}`, { id });
	if (!deleted && row.isDeleted === true)
		throw new RepositoryError('chapter_missing', `Chapter is deleted: ${id}`, {
			id,
			reason: 'deleted'
		});
	return row;
};

/** A stage to write: present, and not deleted unless `deleted` allows it. */
export const requireStage = async (
	transaction: Transaction,
	id: string,
	deleted = false
): Promise<Entity> => {
	const row = await transaction.fetchById('chapterStages', id);
	if (!row) throw new RepositoryError('stage_missing', `Stage not found: ${id}`, { id });
	if (!deleted && row.isDeleted === true)
		throw new RepositoryError('stage_missing', `Stage is deleted: ${id}`, {
			id,
			reason: 'deleted'
		});
	return row;
};

/** A stage starts inside its chapter: never before the chapter's own start. */
export const assertStageInChapter = (stageStart: string, chapter: Entity): void => {
	if (ms(stageStart) < ms(String(chapter.startedAt)))
		throw new RepositoryError('stage_before_chapter', 'A stage cannot start before its chapter', {
			chapterId: chapter.id
		});
};

/** An ISO instant with its offset (or Z), kept exactly as given. */
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

export const nameOf = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || value.trim().length === 0)
		throw invalid('name', `${label} is required`);
	return value.trim();
};

export const noteOf = (value: unknown, label: string): string | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'string') throw invalid('note', `${label} must be a string`);
	return value.trim().length > 0 ? value : null;
};

export const instantOf = (value: unknown, label: string): string => {
	if (typeof value !== 'string' || !ISO_INSTANT.test(value) || !Number.isFinite(ms(value)))
		throw invalid('instant', `${label} must be an ISO instant with an offset`);
	return value;
};

export const colourOf = (value: unknown, label: string): number | null => {
	if (value === null || value === undefined) return null;
	if (typeof value !== 'number' || !Number.isFinite(value))
		throw invalid('colour', `${label} must be a number`);
	return value;
};

export const sameJson = (left: unknown, right: unknown): boolean =>
	JSON.stringify(left) === JSON.stringify(right);

/** A deletion stamps its operation; a return clears it. */
export const lifecyclePatch = (isDeleted: boolean, operation: Operation) => ({
	isDeleted,
	updatedAt: operation.timestamp,
	deletionOperationId: isDeleted ? operation.id : null
});
