import type { MessageKey } from '$lib/state/Locale/types';
import type { ChapterStatus } from './types';

/** A Scope's chapter history at its rail row: the last chapters that had it in front. */
export const HISTORY_TICKS = 5;

/** Gap between a band segment's left edge (or the pinned edge) and its label. */
export const BAND_LABEL_INSET_PX = 6;

/** «текущая», «прошла», «впереди»: the words of a chapter's status. */
export const CHAPTER_STATUS_KEYS = {
	current: 'chapter.statusCurrent',
	past: 'chapter.statusPast',
	future: 'chapter.statusFuture'
} as const satisfies Readonly<Record<ChapterStatus, MessageKey>>;
