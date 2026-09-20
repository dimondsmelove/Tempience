import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
import { scopeTree } from '$lib/model/Projection/tree';
import {
	MAX_LANE_NAME_LENGTH,
	MAX_LANES,
	MAX_MEMBER_ID_LENGTH,
	MERGED_ROW_ID_JOINER
} from './constants';
import type { DropTarget, LaneIds, RowArrangement, RowLane } from './types';

/**
 * Pure operations over the row arrangement (research п. 7; loop 006 Q1–Q3).
 * Every operation returns a new value and leaves an out-of-range index alone,
 * so a stale drag or a stale menu never throws.
 */

/** A lane with only the fields it has; `expanded` is kept on a lane of several members alone (C5). */
const lane = (members: readonly string[], name?: string, expanded?: boolean): RowLane => ({
	members,
	...(name === undefined ? {} : { name }),
	...(expanded && members.length > 1 ? { expanded: true } : {})
});

const inRange = (arrangement: RowArrangement, index: number): boolean =>
	Number.isInteger(index) && index >= 0 && index < arrangement.lanes.length;

/** Every id its own lane, in the given order: the ribbon as the Scope tree has it. */
export const defaultArrangement = (ids: readonly string[]): RowArrangement => ({
	lanes: ids.map((id) => lane([id]))
});

/** The lane at `from` moves so that it ends up at `to`; the others keep their order. */
export const reorder = (arrangement: RowArrangement, from: number, to: number): RowArrangement => {
	if (!inRange(arrangement, from) || !inRange(arrangement, to) || from === to) return arrangement;
	const lanes = arrangement.lanes.filter((_, index) => index !== from);
	lanes.splice(to, 0, arrangement.lanes[from]);
	return { lanes };
};

/**
 * The source lane's members join the target lane, after its own and without
 * repeats; the target keeps its place and its name, the source disappears. A lane
 * merged for the first time stands folded; one already merged keeps its fold (C5).
 */
export const merge = (
	arrangement: RowArrangement,
	sourceLaneIndex: number,
	targetLaneIndex: number
): RowArrangement => {
	if (
		!inRange(arrangement, sourceLaneIndex) ||
		!inRange(arrangement, targetLaneIndex) ||
		sourceLaneIndex === targetLaneIndex
	)
		return arrangement;
	const target = arrangement.lanes[targetLaneIndex];
	const source = arrangement.lanes[sourceLaneIndex];
	const members = [
		...target.members,
		...source.members.filter((id) => !target.members.includes(id))
	];
	return {
		lanes: arrangement.lanes
			.map((item, index) =>
				index === targetLaneIndex ? lane(members, target.name, keptFold(target)) : item
			)
			.filter((_, index) => index !== sourceLaneIndex)
	};
};

/** The fold a lane keeps through a merge into it: its own when it was merged already; a plain lane merged anew stands folded. */
const keptFold = (target: RowLane): boolean | undefined =>
	target.members.length > 1 ? target.expanded : undefined;

/**
 * A lane taken apart (owner review 2026-09-19, п. 32): a member with a default lane of its
 * own — a root Scope, «Без Scope» — becomes a single lane in place; a claimed child has none
 * and goes back under its parent — it leaves the arrangement, and the tree emits it again.
 */
const unmerged = (item: RowLane, defaults: ReadonlySet<string>): RowLane[] =>
	item.members.filter((id) => defaults.has(id)).map((id) => lane([id]));

/**
 * «×»: the lane's root members become single lanes in its place, in their order; its claimed
 * children return to their parents; the name goes. `defaults` are the ids of the default
 * lanes (`LaneIds.defaults`).
 */
export const split = (
	arrangement: RowArrangement,
	laneIndex: number,
	defaults: ReadonlySet<string>
): RowArrangement => {
	if (!inRange(arrangement, laneIndex)) return arrangement;
	return {
		lanes: arrangement.lanes.flatMap((item, index) =>
			index === laneIndex ? unmerged(item, defaults) : [item]
		)
	};
};

/**
 * «↩»: a claimed child leaves the lane that holds it and stands under its parent again; a
 * lane left empty leaves too. A default lane's own id, or a Scope no lane holds, changes nothing.
 */
export const unclaim = (
	arrangement: RowArrangement,
	scopeId: string,
	defaults: ReadonlySet<string>
): RowArrangement => {
	if (defaults.has(scopeId) || !arrangement.lanes.some((item) => item.members.includes(scopeId)))
		return arrangement;
	return {
		lanes: arrangement.lanes.flatMap((item) => {
			if (!item.members.includes(scopeId)) return [item];
			const members = item.members.filter((id) => id !== scopeId);
			return members.length ? [lane(members, item.name, item.expanded)] : [];
		})
	};
};

/**
 * A Scope that is no lane of its own — a child shown under its expanded parent
 * (loop 006 C2, D) — is claimed by the arrangement: dropped on a lane it joins
 * that lane, dropped between lanes it becomes a lane there. Only the emission
 * moves: the child stays in its parent's subtree and in the parent's roll-up
 * when the parent is collapsed (C1). A Scope already placed, or a target out of
 * range, changes nothing.
 */
export const claim = (
	arrangement: RowArrangement,
	scopeId: string,
	target: DropTarget
): RowArrangement => {
	if (arrangement.lanes.some((item) => item.members.includes(scopeId))) return arrangement;
	if (target.kind === 'merge') {
		if (!inRange(arrangement, target.index)) return arrangement;
		return {
			lanes: arrangement.lanes.map((item, index) =>
				index === target.index ? lane([...item.members, scopeId], item.name, keptFold(item)) : item
			)
		};
	}
	if (
		!Number.isInteger(target.index) ||
		target.index < 0 ||
		target.index > arrangement.lanes.length
	)
		return arrangement;
	const lanes = [...arrangement.lanes];
	lanes.splice(target.index, 0, lane([scopeId]));
	return { lanes };
};

/**
 * «Схлопнуть всё»: the whole ribbon as one row with every member, in lane order — the extreme
 * case of the merge, not a separate element (п. 7): every lane merged into the first, which
 * keeps its owner name as a merge target does. One lane already is left alone.
 */
export const collapseAll = (arrangement: RowArrangement): RowArrangement => {
	if (arrangement.lanes.length <= 1) return arrangement;
	const members: string[] = [];
	for (const item of arrangement.lanes)
		for (const id of item.members) if (!members.includes(id)) members.push(id);
	return { lanes: [lane(members, arrangement.lanes[0].name)] };
};

/**
 * «Разделить всё»: every merged lane taken apart as «×» does — root members their own rows
 * again, in lane order, claimed children back under their parents; a single lane, a claimed
 * child placed alone included, stays as it is. Nothing merged is left alone.
 */
export const splitAll = (
	arrangement: RowArrangement,
	defaults: ReadonlySet<string>
): RowArrangement =>
	arrangement.lanes.some((item) => item.members.length > 1)
		? {
				lanes: arrangement.lanes.flatMap((item) =>
					item.members.length > 1 ? unmerged(item, defaults) : [item]
				)
			}
		: arrangement;

/** Two arrangements are the same rows: the same members in the same order, the same owner names. */
export const sameArrangement = (a: RowArrangement, b: RowArrangement): boolean =>
	a.lanes.length === b.lanes.length &&
	a.lanes.every(
		(item, index) =>
			item.name === b.lanes[index].name &&
			item.members.length === b.lanes[index].members.length &&
			item.members.every((id, at) => id === b.lanes[index].members[at])
	);

/** The owner's name for a lane; `null` or blank returns it to the auto-name. */
export const rename = (
	arrangement: RowArrangement,
	laneIndex: number,
	name: string | null
): RowArrangement => {
	if (!inRange(arrangement, laneIndex)) return arrangement;
	const trimmed = name?.trim() ?? '';
	return {
		lanes: arrangement.lanes.map((item, index) =>
			index === laneIndex ? lane(item.members, trimmed ? trimmed : undefined, item.expanded) : item
		)
	};
};

/**
 * The chevron of a merged row (loop 008, C5): its member rows shown beneath it or folded away.
 * A lane of one member has nothing to unfold; the same fold again, or a stale index, changes nothing.
 */
export const setExpanded = (
	arrangement: RowArrangement,
	laneIndex: number,
	expanded: boolean
): RowArrangement => {
	if (!inRange(arrangement, laneIndex)) return arrangement;
	const item = arrangement.lanes[laneIndex];
	if (item.members.length <= 1 || Boolean(item.expanded) === expanded) return arrangement;
	return {
		lanes: arrangement.lanes.map((entry, index) =>
			index === laneIndex ? lane(entry.members, entry.name, expanded) : entry
		)
	};
};

/** The index of the lane that holds a member — a Scope id or the «Без Scope» row id — or −1. */
export const laneIndexOf = (arrangement: RowArrangement, memberId: string): number =>
	arrangement.lanes.findIndex((item) => item.members.includes(memberId));

/**
 * A saved arrangement made to fit the Scopes at hand: members that no longer
 * exist leave, a member met twice stays where it was met first, an emptied
 * lane leaves, and the default lanes not yet placed join at the end in the
 * default order. Stale data never throws.
 */
export const reconcile = (arrangement: RowArrangement, ids: LaneIds): RowArrangement => {
	const seen = new Set<string>();
	const lanes: RowLane[] = [];
	for (const item of arrangement.lanes) {
		const members = item.members.filter((id) => {
			if (!ids.known.has(id) || seen.has(id)) return false;
			seen.add(id);
			return true;
		});
		if (members.length) lanes.push(lane(members, item.name, item.expanded));
	}
	for (const id of ids.defaults) if (!seen.has(id)) lanes.push(lane([id]));
	return { lanes };
};

/**
 * The name a lane shows: the owner's if set, else the first member's name,
 * with «+N» for the members behind it (Q1-A). The full composition is for
 * the tooltip, not the name.
 */
export const laneName = (
	{ members, name }: RowLane,
	scopesById: ReadonlyMap<string, Readonly<{ name: string }>>
): string => {
	if (name) return name;
	const first = scopesById.get(members[0])?.name ?? members[0] ?? '';
	return members.length > 1 ? `${first} +${members.length - 1}` : first;
};

/** The row id of a merged lane: its members joined, stable across reorders. */
export const mergedRowId = (members: readonly string[]): string =>
	members.join(MERGED_ROW_ID_JOINER);

/** The default lanes of a snapshot (root Scopes in their order, then «Без Scope») and every id a lane may hold. */
export const laneIds = (snapshot: Pick<ExplorerSnapshot, 'scopes' | 'intersections'>): LaneIds => {
	const tree = scopeTree(snapshot.scopes, snapshot.intersections);
	return {
		defaults: [...tree.roots, UNSCOPED_ROW_ID],
		known: new Set([...snapshot.scopes.map((scope) => scope.id), UNSCOPED_ROW_ID])
	};
};

const memberId = (value: unknown): value is string =>
	typeof value === 'string' && value.length > 0 && value.length <= MAX_MEMBER_ID_LENGTH;

/**
 * A persisted arrangement read back: only its own fields, within bounds;
 * `null` for anything else, so the device settings refuse it as they refuse
 * any other malformed field.
 */
export const parseArrangement = (value: unknown): RowArrangement | null => {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
	const lanes = (value as { lanes?: unknown }).lanes;
	if (!Array.isArray(lanes) || lanes.length > MAX_LANES) return null;
	const parsed: RowLane[] = [];
	for (const item of lanes) {
		if (typeof item !== 'object' || item === null) return null;
		const { members, name, expanded } = item as {
			members?: unknown;
			name?: unknown;
			expanded?: unknown;
		};
		if (!Array.isArray(members) || members.length === 0 || !members.every(memberId)) return null;
		if (name !== undefined && (typeof name !== 'string' || name.length > MAX_LANE_NAME_LENGTH))
			return null;
		if (expanded !== undefined && typeof expanded !== 'boolean') return null;
		parsed.push(lane([...members], name, expanded));
	}
	return { lanes: parsed };
};
