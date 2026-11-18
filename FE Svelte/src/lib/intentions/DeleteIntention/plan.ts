import type { DeleteMode, DeletePlan, PlanEdge, PlanIntention } from './types';

/** Plans against active intentions and active part_of edges supplied by the caller. */
export const planDeleteIntention = (
	intentionId: string,
	mode: DeleteMode,
	intentions: readonly PlanIntention[],
	edges: readonly PlanEdge[]
): DeletePlan => {
	const ids = new Set(intentions.filter((item) => item.isIntention).map((item) => item.id));
	const parents = new Map<string, Set<string>>();
	const children = new Map<string, Set<string>>();
	for (const { fromId, toId } of edges) {
		if (!ids.has(fromId) || !ids.has(toId)) continue;
		if (!parents.has(fromId)) parents.set(fromId, new Set());
		if (!children.has(toId)) children.set(toId, new Set());
		parents.get(fromId)!.add(toId);
		children.get(toId)!.add(fromId);
	}
	const reachable = new Set<string>();
	const queue = [intentionId];
	for (let i = 0; i < queue.length; i++) {
		for (const child of children.get(queue[i]) ?? []) {
			if (child === intentionId || reachable.has(child)) continue;
			reachable.add(child);
			queue.push(child);
		}
	}
	const deleted = new Set([intentionId]);
	if (mode === 'all') {
		let changed = true;
		while (changed) {
			changed = false;
			for (const id of reachable) {
				if (
					!deleted.has(id) &&
					[...(parents.get(id) ?? [])].every((parent) => deleted.has(parent))
				) {
					deleted.add(id);
					changed = true;
				}
			}
		}
	}
	const deleteIds = [intentionId, ...[...deleted].filter((id) => id !== intentionId).sort()];
	const keptShared =
		mode === 'all'
			? [...reachable]
					.filter((id) => !deleted.has(id))
					.sort()
					.map((id) => ({
						id,
						otherParentIds: [...(parents.get(id) ?? [])]
							.filter((parent) => !deleted.has(parent))
							.sort()
					}))
			: [];
	return { deleteIds, keptShared, descendantCount: deleteIds.length - 1 };
};
