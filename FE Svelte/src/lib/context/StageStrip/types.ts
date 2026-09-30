import type { StagePick, StageWindow } from '$lib/model/Chapters/types';

export type StageStripProps = Readonly<{
	windows: readonly StageWindow[];
	/** The stage in force; null — the whole chapter is. */
	inForceId: string | null;
	/** The stage «сейчас» stands in; null — none. */
	nowId: string | null;
	now: number;
	/** Where an open chapter's strip ends: its last stage and «сейчас», a week on. */
	stripEnd: number;
	/** The chapter's colour: the chosen segment is filled with it. */
	colour: string;
	/** A segment's dates, for its hint. */
	spanOf: (window: StageWindow) => string;
	onchoose: (pick: StagePick) => void;
	/** The rail header's lower strip: shorter, with smaller type. */
	compact?: boolean;
	/** Prefixes the test ids, so the rail's strip and the Context's are told apart. */
	testIdPrefix?: string;
	/** «Вся глава» as the first segment; the rail header drops it, its chapter name stands for it. */
	whole?: boolean;
}>;
