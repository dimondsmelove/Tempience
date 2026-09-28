import { ms, nextMidnight } from './time';
import type { Chapter, ChapterStatus, InsertPlan } from './types';

/** Chapters in time: windows that never overlap, each ending where the next begins. */

export const sortChapters = (chapters: readonly Chapter[]): Chapter[] =>
	chapters.toSorted((a, b) => ms(a.start) - ms(b.start));

export const endOf = (chapter: Chapter): number | null =>
	chapter.end === null ? null : ms(chapter.end);

export const covers = (chapter: Chapter, at: number): boolean => {
	const end = endOf(chapter);
	return ms(chapter.start) <= at && (end === null || at < end);
};

export const statusAt = (chapter: Chapter, now: number): ChapterStatus =>
	covers(chapter, now) ? 'current' : ms(chapter.start) > now ? 'future' : 'past';

/** The chapter whose window holds «сейчас»; windows never overlap. */
export const currentChapter = (chapters: readonly Chapter[], now: number): Chapter | null =>
	chapters.find((chapter) => covers(chapter, now)) ?? null;

/** What saving a new chapter starting at `start` does to the others. */
export const planInsert = (chapters: readonly Chapter[], start: number): InsertPlan => {
	const clash = chapters.find((chapter) => ms(chapter.start) === start) ?? null;
	const ends =
		chapters.find((chapter) => ms(chapter.start) < start && covers(chapter, start)) ?? null;
	const until = sortChapters(chapters).find((chapter) => ms(chapter.start) > start) ?? null;
	return { ends, until, clash };
};

/**
 * The chapters with their ends derived: each runs until the next one starts, or until the owner
 * closed it if that came first (a gap); the last one runs on, open, unless closed.
 */
export const resolveEnds = (chapters: readonly Chapter[]): Chapter[] => {
	const sorted = sortChapters(chapters);
	return sorted.map((chapter, index) => {
		const next = sorted[index + 1];
		const closed =
			chapter.closedAt && ms(chapter.closedAt) > ms(chapter.start) ? chapter.closedAt : null;
		const end = closed && (!next || ms(closed) < ms(next.start)) ? closed : (next?.start ?? null);
		return { ...chapter, closedAt: closed, end };
	});
};

/** The next midnight of the zone after `now` at which no chapter starts yet: a new chapter's default start. */
export const freeMidnight = (
	chapters: readonly Chapter[],
	now: number,
	timeZone: string
): number => {
	let at = nextMidnight(now, timeZone);
	for (let guard = 0; guard < 400 && chapters.some((chapter) => ms(chapter.start) === at); guard++)
		at = nextMidnight(at, timeZone);
	return at;
};

/**
 * The next moment after `now` at which «сейчас» crosses a boundary: a chapter's start or end,
 * or a stage's start; null when none lies ahead.
 */
export const nextBoundary = (chapters: readonly Chapter[], now: number): number | null => {
	let next: number | null = null;
	for (const chapter of chapters) {
		const end = endOf(chapter);
		for (const at of [ms(chapter.start), end, ...chapter.stages.map((stage) => ms(stage.start))])
			if (at !== null && at > now && (next === null || at < next)) next = at;
	}
	return next;
};
