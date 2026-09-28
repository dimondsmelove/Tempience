import type { Level, Lineup, LineupEntry } from '$lib/model/Chapters/types';
import { invalid } from './validation';

/**
 * The stored form of a «Состав»: one JSON array `[{ scopeId, level }]` in the owner's order.
 * Only this module and `read.ts` know it; everything above reads the domain `Lineup`.
 */

const LEVELS: ReadonlySet<string> = new Set<Level>(['focus', 'support']);

const entryOf = (value: unknown): LineupEntry | null => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	const { scopeId, level } = value as Record<string, unknown>;
	// «Поддержка» is gone (owner 2026-09-28): a stored support entry reads, and is written, in front.
	return typeof scopeId === 'string' && scopeId.length > 0 && LEVELS.has(level as string)
		? { scopeId, level: 'focus' }
		: null;
};

/** A lineup as stored, read leniently: a malformed entry or a repeated Scope is left out. */
export const readStoredLineup = (value: unknown): LineupEntry[] => {
	if (!Array.isArray(value)) return [];
	const seen = new Set<string>();
	const entries: LineupEntry[] = [];
	for (const item of value) {
		const entry = entryOf(item);
		if (!entry || seen.has(entry.scopeId)) continue;
		seen.add(entry.scopeId);
		entries.push(entry);
	}
	return entries;
};

/** A lineup to be written: every entry a Scope at a level, each Scope once. */
export const lineupInput = (value: unknown, label = 'Chapter lineup'): LineupEntry[] => {
	if (!Array.isArray(value)) throw invalid('lineup', `${label} must be an array`);
	const seen = new Set<string>();
	return value.map((item) => {
		const entry = entryOf(item);
		if (!entry) throw invalid('lineup', `${label} entry must name a Scope at a level`);
		if (seen.has(entry.scopeId)) throw invalid('lineup', `${label} names a Scope twice`);
		seen.add(entry.scopeId);
		return { scopeId: entry.scopeId, level: entry.level };
	});
};

/** The lineup as read: an entry whose Scope is deleted is left out, and returns with the Scope. */
export const visibleLineup = (stored: Lineup, deletedScopeIds: ReadonlySet<string>): Lineup =>
	stored.filter((entry) => !deletedScopeIds.has(entry.scopeId));

/**
 * A lineup written over one read without the entries of deleted Scopes: those entries are kept,
 * each after the entry it followed, so a restored Scope comes back where it stood.
 */
export const keepHiddenEntries = (
	stored: Lineup,
	next: Lineup,
	deletedScopeIds: ReadonlySet<string>
): LineupEntry[] => {
	const result = [...next];
	const present = new Set(next.map((entry) => entry.scopeId));
	stored.forEach((entry, index) => {
		if (!deletedScopeIds.has(entry.scopeId) || present.has(entry.scopeId)) return;
		let at = 0;
		for (let before = index - 1; before >= 0; before--) {
			const found = result.findIndex((item) => item.scopeId === stored[before].scopeId);
			if (found >= 0) {
				at = found + 1;
				break;
			}
		}
		result.splice(at, 0, entry);
		present.add(entry.scopeId);
	});
	return result;
};
