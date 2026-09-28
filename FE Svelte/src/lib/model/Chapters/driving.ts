import { sortChapters } from './Chapters';
import { HISTORY_TICKS } from './constants';
import { idsAt } from './lineup';
import { stageInForce } from './stages';
import { ms } from './time';
import type { Chapter, Driver, HistoryTick, StagePick } from './types';

/** The driving rule: who orders the rows, and which chapters had a Scope in front. */

/**
 * Who orders the rows for a chapter: the stage in force with its own lineup, or the chapter's
 * lineup — for «Вся глава», for a stage without a lineup of its own, or with no stage in force.
 */
export const driverOf = (chapter: Chapter, pick: StagePick, now: number): Driver => {
	const stage = stageInForce(chapter, pick, now);
	return { chapter, stage, lineup: stage?.lineup ?? chapter.lineup };
};

/**
 * A Scope's chapter history up to a chapter: the chapters, in time, whose lineup had it in
 * front, the last `HISTORY_TICKS` of them; the given chapter's own tick, if any, is last.
 */
export const historyOf = (
	chapters: readonly Chapter[],
	upTo: Chapter,
	scopeId: string
): HistoryTick[] =>
	sortChapters(chapters)
		.filter((item) => ms(item.start) <= ms(upTo.start))
		.filter((item) => idsAt(item.lineup).includes(scopeId))
		.slice(-HISTORY_TICKS)
		.map((item) => ({ chapter: item, driving: item.id === upTo.id }));
