import { endOf, ms, sortChapters, statusAt } from '$lib/model/Chapters';
import type { Chapter } from '$lib/model/Chapters/types';
import { pxAtTime } from '$lib/state/Viewport/math';
import type { TimeWindow } from '$lib/state/Viewport/types';

/** A chapter's line through the lanes: where it starts, or where it ends with nothing after it. */
export type ChapterLine = Readonly<{
	key: string;
	chapter: Chapter;
	x: number;
	future: boolean;
	start: boolean;
}>;

/** A line where each chapter starts, and where one ends with no chapter after it — inside the lanes. */
export const chapterLines = (
	chapters: readonly Chapter[],
	window: TimeWindow,
	widthPx: number,
	now: number
): ChapterLine[] => {
	if (widthPx <= 0) return [];
	const lines: ChapterLine[] = [];
	const sorted = sortChapters(chapters);
	sorted.forEach((chapter, index) => {
		const future = statusAt(chapter, now) === 'future';
		const x = pxAtTime(window, ms(chapter.start), widthPx);
		lines.push({ key: `${chapter.id}:start`, chapter, x, future, start: true });
		const end = endOf(chapter);
		const next = sorted[index + 1];
		if (end !== null && (!next || ms(next.start) !== end))
			lines.push({
				key: `${chapter.id}:end`,
				chapter,
				x: pxAtTime(window, end, widthPx),
				future,
				start: false
			});
	});
	return lines.filter((line) => line.x >= 0 && line.x <= widthPx);
};
