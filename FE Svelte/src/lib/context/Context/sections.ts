import { CONTEXT_TABS, SECTIONS_STORAGE_KEY, type ContextTab } from './constants';

/** `true` for a folded section. */
export type SectionState = Record<ContextTab, boolean>;

const allOpen = (): SectionState =>
	Object.fromEntries(CONTEXT_TABS.map((tab) => [tab.id, false])) as SectionState;

/** Folded sections from storage; anything missing, malformed or unreachable reads as open. */
export const readCollapsed = (
	storage: Storage | undefined = globalThis.localStorage
): SectionState => {
	const state = allOpen();
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(SECTIONS_STORAGE_KEY) ?? 'null');
		if (parsed && typeof parsed === 'object')
			for (const { id } of CONTEXT_TABS)
				if ((parsed as Record<string, unknown>)[id] === true) state[id] = true;
	} catch {
		// Storage can be absent or blocked; the default is fine.
	}
	return state;
};

export const writeCollapsed = (
	state: SectionState,
	storage: Storage | undefined = globalThis.localStorage
): void => {
	try {
		storage?.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(state));
	} catch {
		// Storage can be absent or blocked; the state still lives in the component.
	}
};
