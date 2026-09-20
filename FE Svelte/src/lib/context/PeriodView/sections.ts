import { readFolded, writeFolded } from '$lib/context/Context/sections';

/**
 * Parts of a period's Context (loop 008 polish, owner 2026-09-20): the same foldable sections
 * as a record's and a Scope's, in this order, remembered the same way under a key of their
 * own. «Заметка» stands only while the period has a note; «Активные Scope» only while it has
 * records in a Scope.
 */
export const PERIOD_SECTIONS = [
	{ id: 'overview', label: 'context.tabOverview' },
	{ id: 'note', label: 'period.sectionNote' },
	{ id: 'scopes', label: 'period.activeScopes' },
	{ id: 'records', label: 'period.list' },
	{ id: 'neighborhood', label: 'period.neighborhood' }
] as const;

export type PeriodSection = (typeof PERIOD_SECTIONS)[number]['id'];

/** `true` for a folded section. */
export type PeriodSectionState = Record<PeriodSection, boolean>;

export const PERIOD_SECTIONS_STORAGE_KEY = 'tempience.context.period-sections.v1';

const SECTION_IDS = PERIOD_SECTIONS.map((section) => section.id);

/** Folded sections from storage; anything missing, malformed or unreachable reads as open. */
export const readPeriodCollapsed = (storage?: Storage): PeriodSectionState =>
	readFolded(SECTION_IDS, PERIOD_SECTIONS_STORAGE_KEY, storage);

export const writePeriodCollapsed = (state: PeriodSectionState, storage?: Storage): void =>
	writeFolded(PERIOD_SECTIONS_STORAGE_KEY, state, storage);
