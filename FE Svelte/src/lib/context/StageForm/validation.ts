import { endOf, ms, stageBounds } from '$lib/model/Chapters';
import type { Chapter } from '$lib/model/Chapters/types';
import type { MessageKey } from '$lib/state/Locale/types';

/**
 * Why a stage cannot be saved, or null: it needs a name and a start inside its chapter; an
 * edited stage stays between its neighbours (the first one, starting with the chapter, stays
 * put), and no two stages start at the same moment.
 */
export const stageProblem = (
	chapter: Chapter,
	stageId: string | null,
	name: string,
	startMs: number | null
): MessageKey | null => {
	if (!name.trim()) return 'chapter.stageNameRequired';
	if (startMs === null) return 'chapter.startUnreadable';
	const end = endOf(chapter);
	if (startMs < ms(chapter.start) || (end !== null && startMs >= end)) return 'chapter.stageInside';
	const bounds = stageId ? stageBounds(chapter, stageId) : null;
	if (bounds && !bounds.locked && (bounds.first ? startMs < bounds.min : startMs <= bounds.min))
		return 'chapter.stageAfterPrevious';
	if (bounds && bounds.max !== null && startMs >= bounds.max) return 'chapter.stageBeforeNext';
	if (chapter.stages.some((item) => item.id !== stageId && ms(item.start) === startMs))
		return 'chapter.stageClash';
	return null;
};
