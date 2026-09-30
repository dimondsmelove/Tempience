/**
 * Parts of a chapter's Context: the same foldable sections as a Scope's and a period's,
 * remembered the same way under a key of their own. «Заметка» stands only while there is one.
 */
export const CHAPTER_SECTIONS = [
	{ id: 'note', label: 'chapter.note' },
	{ id: 'stages', label: 'chapter.stages' },
	{ id: 'lineup', label: 'chapter.lineup' },
	{ id: 'records', label: 'chapter.records' }
] as const;

export type ChapterSection = (typeof CHAPTER_SECTIONS)[number]['id'];

export const CHAPTER_SECTIONS_STORAGE_KEY = 'tempience.context.chapter-sections.v1';
