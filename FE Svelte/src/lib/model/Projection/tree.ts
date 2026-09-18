import type { ExplorerIntersection, ExplorerScope, ExplorerTrace } from '$lib/model/Snapshot/types';

export type ScopeTree = Readonly<{
	/** Roots in snapshot order. */
	roots: readonly string[];
	parent: ReadonlyMap<string, string>;
	children: ReadonlyMap<string, readonly string[]>;
}>;

export type ScopeMembership = Readonly<{
	directByScope: ReadonlyMap<string, ReadonlySet<string>>;
	scopesByTrace: ReadonlyMap<string, ReadonlySet<string>>;
}>;

/**
 * Scope hierarchy from `child_of` intersections. The first parent wins and a
 * link that would close a cycle is ignored, as in the previous front.
 */
export const scopeTree = (
	scopes: readonly ExplorerScope[],
	intersections: readonly ExplorerIntersection[]
): ScopeTree => {
	const order = new Map(scopes.map((scope, index) => [scope.id, index]));
	const parent = new Map<string, string>();
	const closesCycle = (childId: string, parentId: string): boolean => {
		const seen = new Set<string>();
		let current: string | undefined = parentId;
		while (current && !seen.has(current)) {
			if (current === childId) return true;
			seen.add(current);
			current = parent.get(current);
		}
		return false;
	};
	for (const link of intersections) {
		if (
			link.kind !== 'child_of' ||
			!order.has(link.fromId) ||
			!order.has(link.toId) ||
			parent.has(link.fromId) ||
			closesCycle(link.fromId, link.toId)
		)
			continue;
		parent.set(link.fromId, link.toId);
	}
	const children = new Map<string, string[]>();
	for (const [childId, parentId] of parent) {
		const list = children.get(parentId) ?? [];
		list.push(childId);
		children.set(parentId, list);
	}
	for (const list of children.values())
		list.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
	const roots = scopes.filter((scope) => !parent.has(scope.id)).map((scope) => scope.id);
	return { roots, parent, children };
};

/** Direct record membership from `belongs_to` intersections (record → Scope). */
export const scopeMembership = (
	traces: readonly ExplorerTrace[],
	scopes: readonly ExplorerScope[],
	intersections: readonly ExplorerIntersection[]
): ScopeMembership => {
	const traceIds = new Set(traces.map((trace) => trace.id));
	const scopeIds = new Set(scopes.map((scope) => scope.id));
	const directByScope = new Map<string, Set<string>>();
	const scopesByTrace = new Map<string, Set<string>>();
	for (const link of intersections) {
		if (link.kind !== 'belongs_to' || !traceIds.has(link.fromId) || !scopeIds.has(link.toId))
			continue;
		(directByScope.get(link.toId) ?? directByScope.set(link.toId, new Set()).get(link.toId))!.add(
			link.fromId
		);
		(scopesByTrace.get(link.fromId) ??
			scopesByTrace.set(link.fromId, new Set()).get(link.fromId))!.add(link.toId);
	}
	return { directByScope, scopesByTrace };
};

/** Ancestors of a scope, nearest first. */
export const ancestorsOf = (tree: ScopeTree, scopeId: string): string[] => {
	const result: string[] = [];
	let current = tree.parent.get(scopeId);
	while (current && !result.includes(current)) {
		result.push(current);
		current = tree.parent.get(current);
	}
	return result;
};

/**
 * Record ids of a scope and its whole subtree, deduplicated by traceId, with
 * `blocked` scopes (hidden, filtered out) contributing nothing.
 */
export const subtreeTraceIds = (
	tree: ScopeTree,
	membership: ScopeMembership,
	blocked: ReadonlySet<string>
): ReadonlyMap<string, ReadonlySet<string>> => {
	const cache = new Map<string, ReadonlySet<string>>();
	const visit = (scopeId: string, path: ReadonlySet<string>): ReadonlySet<string> => {
		const cached = cache.get(scopeId);
		if (cached) return cached;
		const ids = new Set<string>(membership.directByScope.get(scopeId) ?? []);
		if (!path.has(scopeId)) {
			const nextPath = new Set(path).add(scopeId);
			for (const childId of tree.children.get(scopeId) ?? []) {
				if (blocked.has(childId)) continue;
				for (const id of visit(childId, nextPath)) ids.add(id);
			}
		}
		cache.set(scopeId, ids);
		return ids;
	};
	for (const scopeId of [...tree.roots, ...tree.parent.keys()]) visit(scopeId, new Set());
	return cache;
};
