import { CONTEXT_TABS, SECTIONS_STORAGE_KEY, type ContextTab } from './constants';

/** `true` for a folded section. */
export type SectionState = Record<ContextTab, boolean>;

/**
 * The one way a Context remembers its folded sections (C9a-1): a record of `true` flags under
 * a key of its own in storage. Anything missing, malformed or unreachable reads as open, so a
 * section added later opens like every other one; a Scope's and a period's Context read the
 * same way under their own keys.
 */
export const readFolded = <Id extends string>(
	ids: readonly Id[],
	key: string,
	storage: Storage | undefined = globalThis.localStorage
): Record<Id, boolean> => {
	const state = Object.fromEntries(ids.map((id) => [id, false])) as Record<Id, boolean>;
	try {
		const parsed: unknown = JSON.parse(storage?.getItem(key) ?? 'null');
		if (parsed && typeof parsed === 'object')
			for (const id of ids) if ((parsed as Record<string, unknown>)[id] === true) state[id] = true;
	} catch {
		// Storage can be absent or blocked; the default is fine.
	}
	return state;
};

export const writeFolded = (
	key: string,
	state: Readonly<Record<string, boolean>>,
	storage: Storage | undefined = globalThis.localStorage
): void => {
	try {
		storage?.setItem(key, JSON.stringify(state));
	} catch {
		// Storage can be absent or blocked; the state still lives in the component.
	}
};

const TAB_IDS = CONTEXT_TABS.map((tab) => tab.id);

/** Folded sections of a record's Context from storage. */
export const readCollapsed = (storage?: Storage): SectionState =>
	readFolded(TAB_IDS, SECTIONS_STORAGE_KEY, storage);

export const writeCollapsed = (state: SectionState, storage?: Storage): void =>
	writeFolded(SECTIONS_STORAGE_KEY, state, storage);
