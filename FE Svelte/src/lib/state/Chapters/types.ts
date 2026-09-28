import type { Lineup } from '$lib/model/Chapters/types';
import type { TempienceRepository } from '$lib/state/triplit/Repository/types';

/** What the chapters store writes and follows through: the repository's chapter commands and feed. */
export type ChapterWriter = Pick<
	TempienceRepository,
	| 'createChapter'
	| 'editChapter'
	| 'setChapterDeleted'
	| 'createChapterStage'
	| 'editChapterStage'
	| 'setChapterStageDeleted'
	| 'subscribeChapters'
>;

/** The Context's chapter form: a new chapter, an edit, a new or edited stage. */
export type ChapterEditing =
	| Readonly<{ mode: 'new'; start: string; fromChapterId: string | null }>
	| Readonly<{ mode: 'edit'; chapterId: string }>
	| Readonly<{ mode: 'stage'; chapterId: string; stageId: string | null }>;

/** The record form's Scope picker, grouped by the driving lineup (ScopePicker `groups`). */
export type CaptureGroups = Readonly<{
	groups: readonly Readonly<{ label: string; ids: readonly string[] }>[];
	rest: string;
}>;

/** A chapter's own fields as its form writes them. */
export type ChapterFields = Readonly<{
	name: string;
	note: string;
	colorHue: number | null;
	colorChroma: number | null;
	colorDepth: number | null;
	/** ISO instant with offset. */
	start: string;
	/** ISO instant with offset: an explicit end («закрыть раньше»); null — open, to the next chapter. */
	closedAt?: string | null;
	lineup: Lineup;
}>;

/** A stage's own fields as its form writes them; a null lineup is «как у главы». */
export type StageFields = Readonly<{
	name: string;
	note: string;
	start: string;
	lineup: Lineup | null;
}>;
