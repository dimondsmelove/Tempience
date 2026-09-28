import { ms, resolveEnds } from '$lib/model/Chapters';
import type { Chapter, LineupEntry, Stage } from '$lib/model/Chapters/types';
import { RepositoryError } from '../Repository/errors';
import type { Transaction } from '../Repository/types';
import { readStoredLineup, visibleLineup } from './lineup';

/** A stored chapter row, its lineup read but not yet filtered by the Scopes that are deleted. */
export type ChapterRow = Readonly<{
	id: string;
	name: string;
	note: string | null;
	colorHue: number | null;
	colorChroma: number | null;
	colorDepth: number | null;
	startedAt: string;
	closedAt: string | null;
	lineup: readonly LineupEntry[];
	isDeleted: boolean;
	deletionOperationId: string | null;
	createdAt: string;
	updatedAt: string;
}>;

export type ChapterStageRow = Readonly<{
	id: string;
	chapterId: string;
	name: string;
	note: string | null;
	startedAt: string;
	lineup: readonly LineupEntry[] | null;
	isDeleted: boolean;
	deletionOperationId: string | null;
	createdAt: string;
	updatedAt: string;
}>;

const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const number = (value: unknown): number | null =>
	typeof value === 'number' && Number.isFinite(value) ? value : null;

export const normalizeChapterRow = (value: Record<string, unknown>): ChapterRow => ({
	id: String(value.id),
	name: String(value.name),
	note: text(value.note),
	colorHue: number(value.colorHue),
	colorChroma: number(value.colorChroma),
	colorDepth: number(value.colorDepth),
	startedAt: String(value.startedAt),
	closedAt: text(value.closedAt),
	lineup: readStoredLineup(value.lineup),
	isDeleted: Boolean(value.isDeleted),
	deletionOperationId: text(value.deletionOperationId),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

export const normalizeChapterStageRow = (value: Record<string, unknown>): ChapterStageRow => ({
	id: String(value.id),
	chapterId: String(value.chapterId),
	name: String(value.name),
	note: text(value.note),
	startedAt: String(value.startedAt),
	lineup:
		value.lineup === null || value.lineup === undefined ? null : readStoredLineup(value.lineup),
	isDeleted: Boolean(value.isDeleted),
	deletionOperationId: text(value.deletionOperationId),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

/** The Scopes that are deleted: their lineup entries are kept in storage and left out on read. */
export const deletedScopeIdsOf = (scopes: readonly Record<string, unknown>[]): Set<string> =>
	new Set(scopes.filter((scope) => scope.isDeleted === true).map((scope) => String(scope.id)));

export const stageOf = (row: ChapterStageRow, deletedScopeIds: ReadonlySet<string>): Stage => ({
	id: row.id,
	name: row.name,
	note: row.note ?? '',
	start: row.startedAt,
	lineup: row.lineup === null ? null : visibleLineup(row.lineup, deletedScopeIds)
});

/** One chapter with its stages in time; its end is derived later, among the others. */
export const chapterOf = (
	row: ChapterRow,
	stages: readonly ChapterStageRow[],
	deletedScopeIds: ReadonlySet<string>
): Chapter => ({
	id: row.id,
	name: row.name,
	note: row.note ?? '',
	colorHue: row.colorHue,
	colorChroma: row.colorChroma,
	colorDepth: row.colorDepth,
	start: row.startedAt,
	end: null,
	closedAt: row.closedAt,
	lineup: visibleLineup(row.lineup, deletedScopeIds),
	stages: stages
		.filter((stage) => stage.chapterId === row.id)
		.map((stage) => stageOf(stage, deletedScopeIds))
		.toSorted((a, b) => ms(a.start) - ms(b.start) || a.id.localeCompare(b.id))
});

/**
 * The domain chapters from stored rows: the ones not deleted, each with its stages not deleted,
 * in time, their ends derived from the next chapter's start or an explicit close.
 */
export const assembleChapters = (
	chapters: readonly ChapterRow[],
	stages: readonly ChapterStageRow[],
	deletedScopeIds: ReadonlySet<string>
): Chapter[] => {
	const liveStages = stages.filter((stage) => !stage.isDeleted);
	return resolveEnds(
		chapters
			.filter((chapter) => !chapter.isDeleted)
			.map((chapter) => chapterOf(chapter, liveStages, deletedScopeIds))
	);
};

export type ChapterRows = Readonly<{
	chapters: ChapterRow[];
	stages: ChapterStageRow[];
	deletedScopeIds: Set<string>;
}>;

export const readRows = async (fetch: Transaction['fetch']): Promise<ChapterRows> => {
	const [chapters, stages, scopes] = await Promise.all([
		fetch('chapters'),
		fetch('chapterStages'),
		fetch('scopes')
	]);
	return {
		chapters: chapters.map(normalizeChapterRow),
		stages: stages.map(normalizeChapterStageRow),
		deletedScopeIds: deletedScopeIdsOf(scopes)
	};
};

/** One chapter as read, its end derived among the chapters that are not deleted. */
export const readChapter = async (transaction: Transaction, id: string): Promise<Chapter> => {
	const rows = await readRows(transaction.fetch);
	const live = assembleChapters(rows.chapters, rows.stages, rows.deletedScopeIds);
	const found = live.find((chapter) => chapter.id === id);
	if (found) return found;
	// A deleted chapter: shown with the stages that went with it, in the place it held.
	const row = rows.chapters.find((chapter) => chapter.id === id);
	if (!row) throw new RepositoryError('chapter_missing', `Chapter not found: ${id}`, { id });
	const own = rows.stages.filter(
		(stage) =>
			!stage.isDeleted ||
			(row.deletionOperationId !== null && stage.deletionOperationId === row.deletionOperationId)
	);
	return resolveEnds([...live, chapterOf(row, own, rows.deletedScopeIds)]).find(
		(chapter) => chapter.id === id
	)!;
};
