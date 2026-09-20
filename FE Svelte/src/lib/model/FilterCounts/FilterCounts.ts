import { projectSnapshot } from '$lib/model/Projection/Projection';
import { ancestorsOf, scopeTree } from '$lib/model/Projection/tree';
import type { ProjectionState } from '$lib/model/Projection/types';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import type { FilterCounts, ScopeCounts } from './types';

/** What the counts read of the workbench: everything the projection reads apart from the disclosure. */
export type FilterCountsState = Omit<ProjectionState, 'expanded'>;

const NONE: ScopeCounts = Object.freeze({ direct: 0, subtree: 0 });

/**
 * Records of each Kind in the view, each record once: what a Kind's checkbox governs — on the
 * ribbon or parked, in the window or out of it (owner review 2026-09-19, п. 7: the filters say
 * how many records they are about, as the search does).
 */
export const kindCounts = (
	traces: readonly Pick<ExplorerTrace, 'id' | 'kindId'>[]
): ReadonlyMap<string, number> => {
	const seen = new Set<string>();
	const counts = new Map<string, number>();
	for (const trace of traces) {
		if (!trace.kindId || seen.has(trace.id)) continue;
		seen.add(trace.id);
		counts.set(trace.kindId, (counts.get(trace.kindId) ?? 0) + 1);
	}
	return counts;
};

/**
 * `n · Σ m` of every hidden Scope as its rail row would count once it is shown again (owner
 * 2026-09-15: the numbers say what the ribbon shows): «Только эти Scope», the legend and the
 * Kinds stand as they are, and so do the other hidden Scopes — except the Scope's own
 * ancestors, whose hiding only keeps the row out of view and says nothing of the Scope's
 * records. Each Scope is projected on its own, so a hidden child stays out of its hidden
 * parent's subtree while the parent's chip keeps the numbers its row had, and the child's
 * chip keeps its own. The Scope search and the arrangement of the rows are left aside:
 * neither changes what the eye hides, and the rail's search would hide the row altogether.
 */
export const hiddenScopeCounts = (
	snapshot: ExplorerSnapshot,
	state: FilterCountsState
): ReadonlyMap<string, ScopeCounts> => {
	const counts = new Map<string, ScopeCounts>();
	if (state.hiddenScopes.size === 0) return counts;
	// Every group unfolded: the projection visits a row only under an unfolded parent.
	const expanded = new Set(snapshot.scopes.map((scope) => scope.id));
	const tree = scopeTree(snapshot.scopes, snapshot.intersections);
	for (const scopeId of state.hiddenScopes) {
		const lifted = new Set([scopeId, ...ancestorsOf(tree, scopeId)]);
		const hiddenScopes = new Set([...state.hiddenScopes].filter((id) => !lifted.has(id)));
		const { rows } = projectSnapshot(snapshot, {
			...state,
			expanded,
			hiddenScopes,
			scopeQuery: '',
			grouping: 'scope',
			arrangement: null
		});
		const row = rows.find((item) => item.id === scopeId);
		counts.set(scopeId, row ? { direct: row.directCount, subtree: row.subtreeCount } : NONE);
	}
	return counts;
};

export const filterCounts = (
	snapshot: ExplorerSnapshot,
	state: FilterCountsState
): FilterCounts => ({
	kinds: kindCounts(snapshot.traces),
	hiddenScopes: hiddenScopeCounts(snapshot, state)
});

/** The chip's numbers written as the rail writes a group's: «6 · Σ 180». */
export const scopeCountsLabel = ({ direct, subtree }: ScopeCounts): string =>
	`${direct} · Σ ${subtree}`;
