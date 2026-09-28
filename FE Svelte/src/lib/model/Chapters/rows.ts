import { laneIds, reconcile } from '$lib/model/Arrangement/Arrangement';
import type { RowArrangement, RowLane } from '$lib/model/Arrangement/types';
import { scopeTree } from '$lib/model/Projection/tree';
import type { ProjectedRow } from '$lib/model/Projection/types';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { idsAt } from './lineup';
import type { Level, Lineup } from './types';

/** The rows a lineup drives: its Scopes in front, each row's level, the rest folded into one. */

type Tree = Pick<ExplorerSnapshot, 'scopes' | 'intersections'>;

/** A Scope's descendants through `child_of`, itself included. */
export const withDescendants = (ids: readonly string[], tree: Tree): Set<string> => {
	const children = new Map<string, string[]>();
	const scopes = new Set(tree.scopes.map((scope) => scope.id));
	for (const link of tree.intersections) {
		if (link.kind !== 'child_of' || !scopes.has(link.fromId)) continue;
		children.set(link.toId, [...(children.get(link.toId) ?? []), link.fromId]);
	}
	const found = new Set<string>();
	const queue = ids.filter((id) => scopes.has(id));
	while (queue.length) {
		const id = queue.pop()!;
		if (found.has(id)) continue;
		found.add(id);
		queue.push(...(children.get(id) ?? []));
	}
	return found;
};

/** The level of each row the lineup puts in front: its Scope or something under it; focus wins. */
export const rowLevels = (
	rows: readonly ProjectedRow[],
	lineup: Lineup,
	tree: Tree
): Map<string, Level> => {
	const focus = withDescendants(idsAt(lineup, 'focus'), tree);
	const support = withDescendants(idsAt(lineup, 'support'), tree);
	const levels = new Map<string, Level>();
	for (const row of rows) {
		if (row.scopeIds.some((id) => focus.has(id))) levels.set(row.id, 'focus');
		else if (row.scopeIds.some((id) => support.has(id))) levels.set(row.id, 'support');
	}
	return levels;
};

/** A lineup Scope in the order of the rows, and how far in it stands. */
export type LineupRow = Readonly<{ scopeId: string; depth: number }>;

/** Every Scope in the order of the tree, depth first: the order a subtree reads in. */
const treeOrder = (tree: Tree): Map<string, number> => {
	const { roots, children } = scopeTree(tree.scopes, tree.intersections);
	const order = new Map<string, number>();
	const walk = (id: string): void => {
		if (order.has(id)) return;
		order.set(id, order.size);
		for (const child of children.get(id) ?? []) walk(child);
	};
	for (const root of roots) walk(root);
	return order;
};

/**
 * The lineup nested as the rows hold it (owner 2026-09-28): a Scope with a lineup ancestor lies
 * inside that ancestor — a grandchild too, whatever lies between — under its arrow, in the
 * order of the tree; the ones with none are the tops. A lineup is a set: its order says nothing.
 */
export const lineupNesting = (
	lineup: Lineup,
	tree: Tree
): Readonly<{ tops: string[]; under: Map<string, string[]> }> => {
	const order = treeOrder(tree);
	const ids = idsAt(lineup).toSorted(
		(a, b) => (order.get(a) ?? Infinity) - (order.get(b) ?? Infinity)
	);
	const chosen = new Set(ids);
	const parentOf = new Map<string, string>();
	for (const link of tree.intersections)
		if (link.kind === 'child_of') parentOf.set(link.fromId, link.toId);
	const anchorOf = (id: string): string | null => {
		const seen = new Set([id]);
		for (let at = parentOf.get(id); at && !seen.has(at); at = parentOf.get(at)) {
			if (chosen.has(at)) return at;
			seen.add(at);
		}
		return null;
	};
	const under = new Map<string, string[]>();
	const tops: string[] = [];
	for (const id of ids) {
		const anchor = anchorOf(id);
		if (anchor) under.set(anchor, [...(under.get(anchor) ?? []), id]);
		else tops.push(id);
	}
	return { tops, under };
};

/**
 * The rows a lineup drives (owner 2026-09-28: the order is the device's own, a chapter only
 * chooses): the device's lanes in their order, each keeping the lineup Scopes it holds — a
 * lineup Scope inside an unchosen one takes that one's place — then everything else, and every
 * unchosen child of a lineup Scope, folded into one merged row that names itself as the rail
 * does («Белград +5»). A view only: nothing is written.
 */
export const chapterArrangement = (
	lineup: Lineup,
	snapshot: Tree,
	/** The device's own arrangement; none — the Scope tree as it is. */
	device: RowArrangement | null = null,
	/** The shadow unfolded by its arrow: its Scopes stand as rows of their own under it. */
	restOpen = false
): RowArrangement => {
	const ids = laneIds(snapshot);
	const { children } = scopeTree(snapshot.scopes, snapshot.intersections);
	const chosen = new Set(idsAt(lineup).filter((id) => ids.known.has(id)));
	const tops = new Set(lineupNesting(lineup, snapshot).tops.filter((id) => chosen.has(id)));
	const lanes = device
		? reconcile(device, ids).lanes
		: ids.defaults.map((id): RowLane => ({ members: [id] }));
	const below = (id: string): string[] =>
		(children.get(id) ?? []).flatMap((child) => [child, ...below(child)]);
	const front: RowLane[] = [];
	const placed = new Set<string>();
	for (const lane of lanes) {
		const kept = lane.members.filter((id) => tops.has(id));
		if (kept.length) front.push(kept.length === lane.members.length ? lane : { members: kept });
		for (const id of kept) placed.add(id);
		for (const member of lane.members)
			if (!tops.has(member))
				for (const id of below(member))
					if (tops.has(id) && !placed.has(id)) {
						front.push({ members: [id] });
						placed.add(id);
					}
	}
	for (const id of tops) if (!placed.has(id)) front.push({ members: [id] });
	// What the lineup leaves out goes into the shadow, a lineup Scope's own children too: its
	// row stands for what was chosen, and nothing unchosen unfolds under it.
	const inside = [...chosen].flatMap((id) =>
		(children.get(id) ?? []).filter((child) => !chosen.has(child))
	);
	const rest = [
		...lanes.flatMap((lane) => lane.members).filter((id) => !chosen.has(id)),
		...inside
	];
	const shadow: RowLane = restOpen ? { members: rest, expanded: true } : { members: rest };
	return reconcile({ lanes: rest.length > 1 ? [...front, shadow] : front }, ids);
};

/** The lineup as the rail reads it: each top where its row stands, its nested ones under it. */
export const lineupRows = (
	lineup: Lineup,
	tree: Tree,
	arrangement: RowArrangement | null = null
): LineupRow[] => {
	const { tops, under } = lineupNesting(lineup, tree);
	const at = new Map(
		(arrangement?.lanes ?? []).flatMap((lane, index) => lane.members.map((id) => [id, index]))
	);
	const sorted = arrangement
		? tops.toSorted((a, b) => (at.get(a) ?? Infinity) - (at.get(b) ?? Infinity))
		: tops;
	const rows: LineupRow[] = [];
	const place = (scopeId: string, depth: number): void => {
		rows.push({ scopeId, depth });
		for (const child of under.get(scopeId) ?? []) place(child, depth + 1);
	};
	for (const id of sorted) place(id, 0);
	return rows;
};

/** The rows standing for the chapter's contexts or anything under them. */
export const foregroundRowIds = (
	rows: readonly ProjectedRow[],
	foreground: ReadonlySet<string>,
	/** The shadow's Scopes: its row is never in front, whatever of the lineup's subtrees it holds. */
	shadow: ReadonlySet<string> = new Set()
): Set<string> =>
	new Set(
		rows
			.filter(
				(row) =>
					row.scopeIds.some((id) => foreground.has(id)) &&
					!(row.kind === 'merged' && row.scopeIds.every((id) => shadow.has(id)))
			)
			.map((row) => row.id)
	);

/** The unfolded shadow's own rows: every row under a lane that stands for nothing in front. */
export const shadowRowIds = (
	rows: readonly ProjectedRow[],
	front: ReadonlySet<string>
): Set<string> =>
	new Set(rows.filter((row) => row.depth > 0 && !front.has(row.id)).map((row) => row.id));

/** The Scopes folded into a chapter's shadow: its last lane, when it holds none of the lineup. */
export const shadowMembers = (
	arrangement: RowArrangement | null,
	chosen: readonly string[]
): Set<string> => {
	const last = arrangement?.lanes.at(-1);
	return new Set(
		last && last.members.length > 1 && !last.members.some((id) => chosen.includes(id))
			? last.members
			: []
	);
};
