import { treeRows, type Hierarchy } from '../Hierarchy/Hierarchy';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';

export const visibleTreeRows = (
	items: readonly ExplorerTrace[],
	hierarchy: Hierarchy,
	collapsed: ReadonlySet<string>
) => {
	const rows = treeRows(items, hierarchy);
	const ids = new Set(items.map((item) => item.id));
	const visible = new Set<string>();
	const visit = (id: string) => {
		if (visible.has(id)) return;
		visible.add(id);
		if (!collapsed.has(id))
			for (const child of hierarchy.get(id)?.children ?? []) if (ids.has(child)) visit(child);
	};
	for (const row of rows)
		if (!(hierarchy.get(row.trace.id)?.parents ?? []).some((id) => ids.has(id)))
			visit(row.trace.id);
	return rows.filter((row) => visible.has(row.trace.id));
};

const backlogKey = 'tempience.intentions.backlog.open';
/** The backlog floats over the board, so it starts closed. */
export const readBacklogOpen = (storage: Pick<Storage, 'getItem'>): boolean => {
	try {
		return storage.getItem(backlogKey) === 'true';
	} catch {
		return false;
	}
};
export const writeBacklogOpen = (storage: Pick<Storage, 'setItem'>, open: boolean): void => {
	try {
		storage.setItem(backlogKey, String(open));
	} catch {
		/* Storage is optional. */
	}
};
