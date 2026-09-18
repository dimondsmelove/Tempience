/** Parts of a Scope's Context: the same foldable sections as a record's, remembered the same way. */
export const SCOPE_SECTIONS = [
	{ id: 'hierarchy', label: 'scope.sectionHierarchy' },
	{ id: 'kinds', label: 'scope.sectionKinds' },
	{ id: 'records', label: 'scope.sectionRecords' },
	{ id: 'links', label: 'scope.sectionLinks' }
] as const;

export type ScopeSection = (typeof SCOPE_SECTIONS)[number]['id'];

/** `true` for a folded section. */
export type ScopeSectionState = Record<ScopeSection, boolean>;

export const SCOPE_SECTIONS_STORAGE_KEY = 'tempience.context.scope-sections.v1';

const allOpen = (): ScopeSectionState =>
	Object.fromEntries(SCOPE_SECTIONS.map((section) => [section.id, false])) as ScopeSectionState;

/** Folded sections from storage; anything missing, malformed or unreachable reads as open. */
export const readScopeCollapsed = (
	storage: Storage | undefined = globalThis.localStorage
): ScopeSectionState => {
	const state = allOpen();
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(SCOPE_SECTIONS_STORAGE_KEY) ?? 'null');
		if (parsed && typeof parsed === 'object')
			for (const { id } of SCOPE_SECTIONS)
				if ((parsed as Record<string, unknown>)[id] === true) state[id] = true;
	} catch {
		// Storage can be absent or blocked; the default is fine.
	}
	return state;
};

export const writeScopeCollapsed = (
	state: ScopeSectionState,
	storage: Storage | undefined = globalThis.localStorage
): void => {
	try {
		storage?.setItem(SCOPE_SECTIONS_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage can be absent or blocked; the state still lives in the component.
	}
};
