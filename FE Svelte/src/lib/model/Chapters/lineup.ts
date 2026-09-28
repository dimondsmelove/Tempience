import type { Level, Lineup, LineupEntry } from './types';

/** Editing a lineup («Состав»): levels, order, and the editor's one list with a divider. */

/** Focus entries first, then support, each in the owner's order. */
export const ordered = (lineup: Lineup): LineupEntry[] => [
	...lineup.filter((entry) => entry.level === 'focus'),
	...lineup.filter((entry) => entry.level === 'support')
];

export const idsAt = (lineup: Lineup, level?: Level): string[] =>
	lineup.filter((entry) => !level || entry.level === level).map((entry) => entry.scopeId);

/** The lineup as its two fields hold it: the focus, then the support, each in its order. */
export const levelsOf = (lineup: Lineup): Readonly<{ focus: string[]; support: string[] }> => ({
	focus: idsAt(lineup, 'focus'),
	support: idsAt(lineup, 'support')
});

/** The lineup back from its two fields; a Scope in both is kept in the focus. */
export const lineupOf = (focus: readonly string[], support: readonly string[]): LineupEntry[] => [
	...focus.map((scopeId) => ({ scopeId, level: 'focus' as const })),
	...support
		.filter((scopeId) => !focus.includes(scopeId))
		.map((scopeId) => ({ scopeId, level: 'support' as const }))
];

/**
 * A lineup from its Scopes in order (owner 2026-09-28: no «Поддержка» — one ordered lineup,
 * every Scope in it in front); a Scope named twice stands once, where it first stood.
 */
export const lineupFromIds = (ids: readonly string[]): LineupEntry[] =>
	[...new Set(ids)].map((scopeId) => ({ scopeId, level: 'focus' as const }));
