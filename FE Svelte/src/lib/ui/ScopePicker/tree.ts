import type { ScopeOption, ScopePickerGroups, ScopeRow } from './types';

type Link = Readonly<{ kind: string; fromId: string; toId: string }>;

/**
 * Picker options from a Scope list and its `child_of` links: the first parent wins, as in
 * the rail's tree. Records without links, or from a surface that has none, are roots.
 */
export const scopeOptionsOf = (
	scopes: readonly Readonly<{ id: string; name: string }>[],
	intersections: readonly Link[] = []
): ScopeOption[] => {
	const known = new Set(scopes.map((scope) => scope.id));
	const parent = new Map<string, string>();
	for (const link of intersections) {
		if (link.kind !== 'child_of' || !known.has(link.fromId) || !known.has(link.toId)) continue;
		if (!parent.has(link.fromId)) parent.set(link.fromId, link.toId);
	}
	return scopes.map((scope) => ({
		id: scope.id,
		name: scope.name,
		parentId: parent.get(scope.id) ?? null
	}));
};

const byId = (scopes: readonly ScopeOption[]): ReadonlyMap<string, ScopeOption> =>
	new Map(scopes.map((scope) => [scope.id, scope]));

/** Ancestors of a Scope, root first; a cycle or a missing parent ends the line. */
export const scopeAncestors = (scopes: readonly ScopeOption[], id: string): ScopeOption[] => {
	const index = byId(scopes);
	const line: ScopeOption[] = [];
	const seen = new Set<string>([id]);
	let current = index.get(id)?.parentId ?? null;
	while (current && !seen.has(current)) {
		const scope = index.get(current);
		if (!scope) break;
		seen.add(current);
		line.unshift(scope);
		current = scope.parentId;
	}
	return line;
};

/** Ancestor names of a Scope, root first. */
export const scopePath = (scopes: readonly ScopeOption[], id: string): string[] =>
	scopeAncestors(scopes, id).map((scope) => scope.name);

/**
 * The list of the picker, always in tree order with depth. Without a search, children of
 * a collapsed Scope are left out. With one, a Scope is listed when its name carries the
 * text or something under it does; the latter is not a match itself, only the way there.
 * Children of a missing parent, and of a parent that would close a cycle, are roots.
 */
export const scopeRows = (
	scopes: readonly ScopeOption[],
	query = '',
	collapsed: ReadonlySet<string> = new Set()
): ScopeRow[] => {
	const index = byId(scopes);
	const children = new Map<string | null, ScopeOption[]>();
	const rootOf = (scope: ScopeOption): string | null => {
		if (scope.parentId === null || !index.has(scope.parentId)) return null;
		const seen = new Set<string>([scope.id]);
		let current: string | null = scope.parentId;
		while (current && !seen.has(current)) {
			seen.add(current);
			current = index.get(current)?.parentId ?? null;
		}
		return current === null ? scope.parentId : null;
	};
	for (const scope of scopes) {
		const parentId = rootOf(scope);
		const list = children.get(parentId) ?? [];
		list.push(scope);
		children.set(parentId, list);
	}
	const needle = query.trim().toLocaleLowerCase();
	const rows: ScopeRow[] = [];
	/** Appends the subtree; returns whether anything in it matched. */
	const visit = (parentId: string | null, depth: number, path: readonly string[]): boolean => {
		let any = false;
		for (const scope of children.get(parentId) ?? []) {
			const own = !needle || scope.name.toLocaleLowerCase().includes(needle);
			const at = rows.length;
			const kids = children.get(scope.id) ?? [];
			rows.push({
				id: scope.id,
				name: scope.name,
				depth,
				path,
				hasChildren: kids.length > 0,
				match: own
			});
			const below =
				!needle && collapsed.has(scope.id)
					? false
					: visit(scope.id, depth + 1, [...path, scope.name]);
			if (needle && !own && !below) rows.splice(at, rows.length - at);
			any = any || own || below;
		}
		return any;
	};
	visit(null, 0, []);
	return rows;
};

/**
 * The list led by groups: each group's Scopes with their subtrees, in the group's order, the
 * group's caption on its first line; then everything else in tree order under `rest`. A Scope
 * listed by an earlier group is not repeated; a fold hides a subtree as in the plain tree.
 */
export const groupedScopeRows = (
	scopes: readonly ScopeOption[],
	{ groups, rest }: ScopePickerGroups,
	collapsed: ReadonlySet<string> = new Set()
): ScopeRow[] => {
	const full = scopeRows(scopes);
	const taken = new Set<string>();
	const out: ScopeRow[] = [];
	const push = (slice: readonly ScopeRow[], base: number, caption: string): void => {
		let hideBelow: number | null = null;
		let first = true;
		slice.forEach((row, index) => {
			if (hideBelow !== null && row.depth > hideBelow) return;
			const hasChildren = (slice[index + 1]?.depth ?? -1) > row.depth;
			hideBelow = hasChildren && collapsed.has(row.id) ? row.depth : null;
			out.push({ ...row, depth: row.depth - base, hasChildren, ...(first ? { caption } : {}) });
			first = false;
		});
	};
	for (const group of groups) {
		const lines: ScopeRow[] = [];
		for (const id of group.ids) {
			const at = full.findIndex((row) => row.id === id);
			if (at < 0 || taken.has(id)) continue;
			const base = full[at].depth;
			let end = at + 1;
			while (end < full.length && full[end].depth > base) end++;
			for (const row of full.slice(at, end)) {
				if (taken.has(row.id)) continue;
				taken.add(row.id);
				lines.push({ ...row, depth: row.depth - base });
			}
		}
		push(lines, 0, group.label);
	}
	push(
		full.filter((row) => !taken.has(row.id)),
		0,
		rest
	);
	return out;
};
