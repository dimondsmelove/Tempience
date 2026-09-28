import type { Chapter } from '$lib/model/Chapters/types';
import type { TempienceTriplitClient } from '../client';
import { assertStorageSchemaReady } from '../Repository/readiness';
import {
	assembleChapters,
	deletedScopeIdsOf,
	normalizeChapterRow,
	normalizeChapterStageRow,
	type ChapterRow,
	type ChapterStageRow
} from './read';

/**
 * The chapters as `listChapters` reads them, live: every change of a chapter, a stage, or a
 * Scope's deletion answers with the whole list again. The collections are newer than some
 * stored schemas, so the subscriptions open only after the readiness check.
 */
export const subscribeChapters = (
	client: TempienceTriplitClient,
	next: (chapters: Chapter[]) => void,
	fail: (error: unknown) => void
): (() => void) => {
	let chapters: ChapterRow[] | null = null;
	let stages: ChapterStageRow[] | null = null;
	let deletedScopeIds: Set<string> | null = null;
	const emit = (): void => {
		if (chapters && stages && deletedScopeIds)
			next(assembleChapters(chapters, stages, deletedScopeIds));
	};
	let unsubscribes: (() => void)[] = [];
	let cancelled = false;
	assertStorageSchemaReady(client).then(() => {
		if (cancelled) return;
		unsubscribes = [
			client.subscribe(
				client.query('chapters'),
				(rows) => {
					chapters = rows.map((row) => normalizeChapterRow(row as Record<string, unknown>));
					emit();
				},
				fail
			),
			client.subscribe(
				client.query('chapterStages'),
				(rows) => {
					stages = rows.map((row) => normalizeChapterStageRow(row as Record<string, unknown>));
					emit();
				},
				fail
			),
			client.subscribe(
				client.query('scopes').Where('isDeleted', '=', true),
				(rows) => {
					deletedScopeIds = deletedScopeIdsOf(rows as Record<string, unknown>[]);
					emit();
				},
				fail
			)
		];
	}, fail);
	return () => {
		cancelled = true;
		for (const unsubscribe of unsubscribes) unsubscribe();
	};
};
