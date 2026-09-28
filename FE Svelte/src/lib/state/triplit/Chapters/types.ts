import type { Chapter, Lineup, Stage } from '$lib/model/Chapters/types';
import type { Operation } from '../Repository/transaction';
import type { LogActor } from '../types';

/** A new chapter: its end is never given — the next chapter's start, or a later close, sets it. */
export type ChapterDraft = Readonly<{
	name: string;
	note?: string | null;
	colorHue?: number | null;
	colorChroma?: number | null;
	colorDepth?: number | null;
	/** ISO instant with offset. */
	start: string;
	/** ISO instant with offset: an explicit early close; null or absent — none. */
	closedAt?: string | null;
	lineup?: Lineup;
}>;

export type ChapterPatch = Partial<ChapterDraft>;

/** A new stage of a chapter; a lineup of null or none — «как у главы». */
export type ChapterStageDraft = Readonly<{
	name: string;
	note?: string | null;
	/** ISO instant with offset. */
	start: string;
	lineup?: Lineup | null;
}>;

export type ChapterStagePatch = Partial<ChapterStageDraft>;

/** A chapter after its deletion or return, with the operation that wrote it or `null` for none. */
export type ChapterLifecycleResult = Readonly<{
	chapter: Chapter;
	isDeleted: boolean;
	operation: Operation | null;
}>;

/** A stage after its deletion or return, with the operation that wrote it or `null` for none. */
export type ChapterStageLifecycleResult = Readonly<{
	stage: Stage;
	chapterId: string;
	isDeleted: boolean;
	operation: Operation | null;
}>;

export type ChapterRepository = {
	/** The chapters that are not deleted, in time, with their stages and derived ends. */
	listChapters: () => Promise<Chapter[]>;
	createChapter: (draft: ChapterDraft, actor?: LogActor) => Promise<Chapter>;
	editChapter: (id: string, patch: ChapterPatch, actor?: LogActor) => Promise<Chapter>;
	/** Deletes a chapter with its stages, or restores it with the stages that went with it. */
	setChapterDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<ChapterLifecycleResult>;
	createChapterStage: (
		chapterId: string,
		draft: ChapterStageDraft,
		actor?: LogActor
	) => Promise<Stage>;
	editChapterStage: (id: string, patch: ChapterStagePatch, actor?: LogActor) => Promise<Stage>;
	setChapterStageDeleted: (
		id: string,
		isDeleted: boolean,
		actor?: LogActor
	) => Promise<ChapterStageLifecycleResult>;
};
