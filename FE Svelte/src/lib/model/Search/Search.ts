import type { Searchable } from './types';

const NONE: ReadonlySet<string> = new Set();

/** The query as compared: trimmed, case-folded; empty means no search. */
export const normalizeQuery = (query: string): string => query.trim().toLocaleLowerCase();

/**
 * Whether a record answers the query: a case-insensitive substring of its
 * title (as displayed and as stored) or its description (research п. 9,
 * Decision Q2-A). An empty query matches everything.
 */
export const matchesQuery = (record: Searchable, query: string): boolean => {
	const needle = normalizeQuery(query);
	if (!needle) return true;
	return [record.displayTitle, record.content, record.description].some(
		(text) => typeof text === 'string' && text.toLocaleLowerCase().includes(needle)
	);
};

/**
 * Ids of the records the query does not match — what the ribbon and the
 * overview dim to 18 %. Empty for an empty query, so no search dims nothing.
 * Search changes only how marks draw: rows, layout and the parked list stay.
 */
export const dimmedTraceIds = (
	query: string,
	records: Iterable<Searchable>
): ReadonlySet<string> => {
	if (!normalizeQuery(query)) return NONE;
	const dimmed = new Set<string>();
	for (const record of records) if (!matchesQuery(record, query)) dimmed.add(record.id);
	return dimmed;
};
