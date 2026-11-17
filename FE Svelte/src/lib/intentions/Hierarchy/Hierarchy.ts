import type { ExplorerIntersection, ExplorerTrace } from '$lib/model/Snapshot/types';
import { traceAboutTimeBounds } from '$lib/state/triplit/trace-time';
import { isIntentionRelation } from '$lib/state/triplit/Traces/roles';

export type HierarchyEntry = {
	parents: string[];
	children: string[];
	progress: { done: number; total: number } | null;
	closeSuggested: boolean;
};
export type Hierarchy = Map<string, HierarchyEntry>;

const compareId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const startOf = (trace: ExplorerTrace): number => {
	if (trace.aboutTime?.basis !== 'absolute') return Infinity;
	return (
		traceAboutTimeBounds(trace.aboutKind, trace.aboutTime, trace.statedDuration)?.start ?? Infinity
	);
};

/** Builds an acyclic projection; malformed cycle-closing edges are ignored. */
export const buildHierarchy = (
	traces: readonly ExplorerTrace[],
	links: readonly ExplorerIntersection[]
): Hierarchy => {
	const intentions = new Map(
		traces.filter((trace) => isIntentionRelation(trace.relation)).map((trace) => [trace.id, trace])
	);
	const hierarchy: Hierarchy = new Map(
		[...intentions.keys()].map((id) => [
			id,
			{ parents: [], children: [], progress: null, closeSuggested: false }
		])
	);
	// Sorting makes the choice of rejected edge deterministic even for a corrupt graph.
	const edges = links
		.filter(
			(link) => link.kind === 'part_of' && intentions.has(link.fromId) && intentions.has(link.toId)
		)
		.toSorted((a, b) => compareId(a.fromId, b.fromId) || compareId(a.toId, b.toId));
	for (const { fromId, toId } of edges) {
		const part = hierarchy.get(fromId)!;
		if (part.parents.includes(toId)) continue;
		const pending = [toId];
		const seen = new Set<string>();
		let cycle = false;
		while (pending.length) {
			const id = pending.pop()!;
			if (id === fromId) {
				cycle = true;
				break;
			}
			if (seen.has(id)) continue;
			seen.add(id);
			pending.push(...hierarchy.get(id)!.parents);
		}
		if (cycle) continue;
		part.parents.push(toId);
		hierarchy.get(toId)!.children.push(fromId);
	}
	for (const [id, entry] of hierarchy) {
		entry.parents.sort(compareId);
		entry.children.sort(
			(a, b) => startOf(intentions.get(a)!) - startOf(intentions.get(b)!) || compareId(a, b)
		);
		if (entry.children.length) {
			const done = entry.children.filter(
				(child) => intentions.get(child)!.intentOpen === false
			).length;
			entry.progress = { done, total: entry.children.length };
			entry.closeSuggested =
				intentions.get(id)!.intentOpen !== false && done === entry.children.length;
		}
	}
	return hierarchy;
};

export const crumbOf = (id: string, hierarchy: Hierarchy, traces: readonly ExplorerTrace[]) => {
	const parents = hierarchy.get(id)?.parents ?? [];
	if (!parents.length) return null;
	const parent = traces.find((trace) => trace.id === parents[0]);
	return parent ? { title: parent.content, extra: parents.length - 1 } : null;
};

/** Preserve every supplied item once, flattening all descendants to one indentation level. */
export const treeRows = (items: readonly ExplorerTrace[], hierarchy: Hierarchy) => {
	const byId = new Map(items.map((trace) => [trace.id, trace]));
	const roots = items.filter(
		(trace) => !(hierarchy.get(trace.id)?.parents ?? []).some((id) => byId.has(id))
	);
	const rows: { trace: ExplorerTrace; level: number }[] = [];
	const seen = new Set<string>();
	for (const root of [...roots, ...items]) {
		if (seen.has(root.id)) continue;
		const pending = [{ id: root.id, level: 0 }];
		while (pending.length) {
			const { id, level } = pending.pop()!;
			const trace = byId.get(id);
			if (!trace || seen.has(id)) continue;
			seen.add(id);
			rows.push({ trace, level });
			const children = hierarchy.get(id)?.children ?? [];
			for (let i = children.length - 1; i >= 0; i--) pending.push({ id: children[i], level: 1 });
		}
	}
	return rows;
};
