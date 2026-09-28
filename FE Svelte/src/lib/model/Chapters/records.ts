import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { withDescendants } from './rows';
import type { ChapterRecord } from './types';

/** A chapter's records: never stored, derived from its lineup inside its window. */

type RecordView = Pick<ExplorerSnapshot, 'traces' | 'intersections'>;

/** When a record is about: its drawn start, else its absolute start; null when unplaced. */
export const startOf = (
	trace: ExplorerSnapshot['traces'][number],
	drawn: ReadonlyMap<string, Readonly<{ start: number }>>
): number | null => {
	const known = drawn.get(trace.id)?.start;
	if (known !== undefined) return known;
	return trace.aboutTime?.basis === 'absolute' ? Date.parse(trace.aboutTime.start) : null;
};

/** The records in any of `scopes` about a time in `[start, end)`, oldest first. */
export const recordsIn = (
	view: RecordView,
	scopes: ReadonlySet<string>,
	start: number,
	end: number,
	drawn: ReadonlyMap<string, Readonly<{ start: number }>>
): ChapterRecord[] => {
	const memberships = new Map<string, string[]>();
	for (const link of view.intersections) {
		if (link.kind !== 'belongs_to' || !scopes.has(link.toId)) continue;
		memberships.set(link.fromId, [...(memberships.get(link.fromId) ?? []), link.toId]);
	}
	const records: ChapterRecord[] = [];
	for (const trace of view.traces) {
		const scopeIds = memberships.get(trace.id);
		if (!scopeIds) continue;
		const at = startOf(trace, drawn);
		if (at === null || at < start || at >= end) continue;
		records.push({
			id: trace.id,
			title: trace.displayTitle ?? trace.content,
			at,
			intent: trace.relation === 'intend',
			scopeIds
		});
	}
	return records.toSorted((a, b) => a.at - b.at);
};

/**
 * How many of a chapter's records fall under each lineup Scope, its nested Scopes included:
 * what a lineup chip counts in the Context. A record under two of them counts for both.
 */
export const countsUnder = (
	records: readonly ChapterRecord[],
	ids: readonly string[],
	tree: Pick<ExplorerSnapshot, 'scopes' | 'intersections'>
): Map<string, number> =>
	new Map(
		ids.map((id) => {
			const under = withDescendants([id], tree);
			return [id, records.filter((record) => record.scopeIds.some((at) => under.has(at))).length];
		})
	);
