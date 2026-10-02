/**
 * Each record once down a branch of the tree (owner 2026-10-02): a row draws its Scope's own
 * records, and of the subtree only what stands in no row of its own. A descendant with a row —
 * its own row, a member row under an unfolded lane, or the lane it was claimed or lined up
 * into — takes its whole subtree along; the walk stops there, unless that row is this one (a
 * lane of a parent and its child weaves both colours). A record in two unrelated Scopes
 * still stands in both rows: that is the weave, not a copy.
 */

/** What one Scope brings to a row: its direct records, and the roll-up nothing else shows. */
export type Drawn = Readonly<{ direct: ReadonlySet<string>; rolled: ReadonlySet<string> }>;

const NONE: ReadonlySet<string> = new Set();
const NOTHING: Drawn = { direct: NONE, rolled: NONE };

/**
 * The records a row draws for one of its Scopes. `holders` names the row each Scope stands in
 * by name; a Scope whose row is another one (a lane member unfolded into its own row) brings
 * nothing here. `children` gives the visible children of a Scope; `directByScope` the records
 * each Scope holds directly. A record both direct and reached through the subtree is direct.
 */
export const drawnRecords = (
	scopeId: string,
	rowId: string,
	holders: ReadonlyMap<string, string>,
	children: (scopeId: string) => readonly string[],
	directByScope: ReadonlyMap<string, ReadonlySet<string>>
): Drawn => {
	if (holders.get(scopeId) !== rowId) return NOTHING;
	const direct = directByScope.get(scopeId) ?? NONE;
	const rolled = new Set<string>();
	const walk = (id: string): void => {
		for (const childId of children(id)) {
			const holder = holders.get(childId);
			if (holder !== undefined && holder !== rowId) continue;
			for (const traceId of directByScope.get(childId) ?? []) rolled.add(traceId);
			walk(childId);
		}
	};
	walk(scopeId);
	for (const traceId of direct) rolled.delete(traceId);
	return { direct, rolled };
};
