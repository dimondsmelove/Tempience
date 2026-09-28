import { ms } from '$lib/model/Chapters';
import type { Chapter, InsertPlan } from '$lib/model/Chapters/types';
import type { MessageKey } from '$lib/state/Locale/types';

/** Why a chapter cannot be saved: the message and, for a clash, the chapter already there. */
export type ChapterProblem = Readonly<{ key: MessageKey; name?: string }>;

/**
 * The stage an edited chapter's new start would leave outside: the first one, in time, that
 * starts before it without having started with the chapter (that one moves with the start).
 */
export const stageBeforeStart = (chapter: Chapter, startMs: number) =>
	chapter.stages
		.filter((stage) => ms(stage.start) !== ms(chapter.start) && ms(stage.start) < startMs)
		.toSorted((a, b) => ms(a.start) - ms(b.start))[0] ?? null;

/**
 * Why a chapter cannot be saved, or null: it needs a name and a readable start; no other chapter
 * may start at that moment; an end, when given, comes after the start and not after the next
 * chapter's start; an edited chapter starts before the chapter after it and not after one of
 * its stages (the stage that started with it moves along); and a chapter it starts inside ends
 * there only once that end is confirmed.
 */
export const chapterProblem = (
	name: string,
	startMs: number | null,
	plan: InsertPlan | null,
	ownEnd: number | null,
	confirmEnd: boolean,
	chapter: Chapter | null = null,
	end: number | null = null
): ChapterProblem | null => {
	if (!name.trim()) return { key: 'chapter.nameRequired' };
	if (startMs === null) return { key: 'chapter.startUnreadable' };
	if (plan?.clash) return { key: 'chapter.clash', name: plan.clash.name };
	if (end !== null && end <= startMs) return { key: 'error.chapter_invalid_close' };
	if (end !== null && plan?.until && end > ms(plan.until.start))
		return { key: 'error.chapter_invalid_closeAfterNext', name: plan.until.name };
	if (ownEnd !== null && startMs >= ownEnd) return { key: 'chapter.startBeforeEnd' };
	const early = chapter ? stageBeforeStart(chapter, startMs) : null;
	if (early) return { key: 'error.chapter_invalid_stages', name: early.name };
	if (plan?.ends && !confirmEnd) return { key: 'chapter.confirmEnd' };
	return null;
};
