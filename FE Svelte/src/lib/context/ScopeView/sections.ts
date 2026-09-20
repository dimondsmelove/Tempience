import { readFolded, writeFolded } from '$lib/context/Context/sections';

/**
 * Parts of a Scope's Context: the same foldable sections as a record's, remembered the same
 * way. The note stands first, right after the name, and only while the Scope has one (owner
 * 2026-09-20: a long note is what the fold is for).
 */
export const SCOPE_SECTIONS = [
	{ id: 'note', label: 'scope.sectionNote' },
	{ id: 'hierarchy', label: 'scope.sectionHierarchy' },
	{ id: 'kinds', label: 'scope.sectionKinds' },
	{ id: 'records', label: 'scope.sectionRecords' },
	{ id: 'links', label: 'scope.sectionLinks' }
] as const;

export type ScopeSection = (typeof SCOPE_SECTIONS)[number]['id'];

/** `true` for a folded section. */
export type ScopeSectionState = Record<ScopeSection, boolean>;

export const SCOPE_SECTIONS_STORAGE_KEY = 'tempience.context.scope-sections.v1';

const SECTION_IDS = SCOPE_SECTIONS.map((section) => section.id);

/** Folded sections from storage; anything missing, malformed or unreachable reads as open. */
export const readScopeCollapsed = (storage?: Storage): ScopeSectionState =>
	readFolded(SECTION_IDS, SCOPE_SECTIONS_STORAGE_KEY, storage);

export const writeScopeCollapsed = (state: ScopeSectionState, storage?: Storage): void =>
	writeFolded(SCOPE_SECTIONS_STORAGE_KEY, state, storage);
