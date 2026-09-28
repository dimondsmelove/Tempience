/**
 * Chapters (research/active/chapters.md, issue #82): authored stretches of life that frame the
 * workbench while they are current. Pure domain shapes: nothing here knows how they are stored.
 */

/** «Фокус» — where I push; «Поддержка» — what I keep up. */
export type Level = 'focus' | 'support';

/** One Scope in front of a chapter or a stage, at its level. */
export type LineupEntry = Readonly<{ scopeId: string; level: Level }>;

/** The Scopes in front («Состав»), in the owner's order; the rows show focus first, then support. */
export type Lineup = readonly LineupEntry[];

/** A stretch inside a chapter: from its start to the next stage's, or to the chapter's end. */
export type Stage = Readonly<{
	id: string;
	name: string;
	note: string;
	/** ISO instant with offset. */
	start: string;
	/** The stage's own front; null — «как у главы». */
	lineup: Lineup | null;
}>;

/** An authored stretch of life that frames the whole workbench while it is current. */
export type Chapter = Readonly<{
	id: string;
	name: string;
	/** «Заметка»: what the chapter is about, in the owner's words. */
	note: string;
	colorHue: number | null;
	colorChroma: number | null;
	colorDepth: number | null;
	/** ISO instant with offset. */
	start: string;
	/**
	 * Where the chapter ends, derived: the next chapter's start, or `closedAt` when the owner
	 * closed it earlier; null — open. Never stored as such: `resolveEnds` computes it on read.
	 */
	end: string | null;
	/** ISO instant the owner closed the chapter at («Закрыть главу»); it may leave a gap. */
	closedAt: string | null;
	/** The Scopes in front while the chapter drives the rows, rebuilt from chapter to chapter. */
	lineup: Lineup;
	stages: readonly Stage[];
}>;

/** What a chapter is to «сейчас». */
export type ChapterStatus = 'past' | 'current' | 'future';

/** Who orders the rows now: a chapter, or one of its stages with a lineup of its own. */
export type Driver = Readonly<{
	chapter: Chapter;
	/** The stage in force: the one chosen, or the current one; null — the whole chapter. */
	stage: Stage | null;
	/** The stage's own lineup, or the chapter's when the stage has none or the whole chapter drives. */
	lineup: Lineup;
}>;

/**
 * What the strip chose in a chapter: `'whole'` — the whole chapter; a stage id; `null` —
 * nothing yet (after the band's or the rail header's click): the current stage is in force.
 */
export type StagePick = 'whole' | string | null;

/** A stage with the time it covers; `end` null runs on to the chapter's end or open end. */
export type StageWindow = Readonly<{ stage: Stage; start: number; end: number | null }>;

/** One stage of a chapter as the band draws it, in px of the lanes' width. */
export type BandStage = Readonly<{
	id: string;
	name: string;
	x0: number;
	x1: number;
	labelX: number;
	current: boolean;
}>;

/** One chapter as the band draws it: its visible span, its sticky label and its stages. */
export type BandSegment = Readonly<{
	id: string;
	name: string;
	/** Unclipped span: x1 runs past the width for an open chapter. */
	x0: number;
	x1: number;
	/** Where the name sits: pinned to the left edge while the chapter's start is off screen. */
	labelX: number;
	open: boolean;
	status: ChapterStatus;
	stages: readonly BandStage[];
}>;

/** What saving a new chapter at a start would do to its neighbours. */
export type InsertPlan = Readonly<{
	/** The chapter whose window holds the start: it ends at that moment. */
	ends: Chapter | null;
	/** The next chapter after the start: the new one ends where it begins. */
	until: Chapter | null;
	/** A chapter already starting at that very moment: the new one cannot. */
	clash: Chapter | null;
}>;

/** One tick of a Scope's chapter history: the chapter, and whether it is the driving one. */
export type HistoryTick = Readonly<{ chapter: Chapter; driving: boolean }>;

/** A record of a chapter's contexts inside its window. */
export type ChapterRecord = Readonly<{
	id: string;
	title: string;
	at: number;
	intent: boolean;
	scopeIds: readonly string[];
}>;
