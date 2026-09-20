import {
	claim,
	collapseAll,
	defaultArrangement,
	merge,
	reconcile,
	rename,
	reorder,
	sameArrangement,
	setExpanded,
	split,
	splitAll,
	unclaim
} from '$lib/model/Arrangement/Arrangement';
import type { DropTarget, LaneIds, RowArrangement } from '$lib/model/Arrangement/types';
import { ARRANGEMENT_UNDO_TTL_MS } from './constants';
import type { ArrangementChange, ArrangementStore, ArrangementUndo } from './types';

/** A store that forgets: the default for tests and for a workbench without a device. */
export const memoryArrangementStore = (): ArrangementStore => {
	let value: RowArrangement | null = null;
	return { read: () => value, write: (next) => (value = next) };
};

/**
 * The rows as arranged on this device (research п. 7, Q3-A): the saved
 * arrangement made to fit the Scopes at hand, and the actions the rail and
 * its menu take on it (loop 006 C2/C3). Every action writes the whole
 * arrangement back through the device settings, as `railOpen` and
 * `legendOpen` are written; `reset` returns to the default order.
 *
 * Undo is one level (Q4-A): a change of the rail — merge, reorder, split,
 * unclaim, rename — or of its «⋯» menu — collapse all, split all, reset (C3) — keeps
 * the arrangement it replaced for `ARRANGEMENT_UNDO_TTL_MS`; `undo` writes it
 * back; the next change replaces the offer. A change that does nothing
 * offers nothing, and the menu shows it disabled. The fold of a merged lane
 * (C5) is view state: written with the arrangement, offered back never — an
 * undo of the change before it restores the fold that change saw.
 */
export class ArrangementState {
	/** Where the arrangement is kept; the app binds the device settings, tests keep it in memory. */
	store: ArrangementStore = memoryArrangementStore();
	/** The last change and the arrangement before it, while it can be taken back. */
	pending = $state.raw<ArrangementUndo | null>(null);
	readonly #lanes: () => LaneIds;
	readonly #ttlMs: number;
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(lanes: () => LaneIds, ttlMs = ARRANGEMENT_UNDO_TTL_MS) {
		this.#lanes = lanes;
		this.#ttlMs = ttlMs;
	}

	/** The saved arrangement fitted to the current Scopes; `null` is the default order. */
	get current(): RowArrangement | null {
		const saved = this.store.read();
		return saved ? reconcile(saved, this.#lanes()) : null;
	}

	/** What the rail shows, as lanes: the current arrangement, or the default order spelled out. */
	get lanes(): RowArrangement {
		return this.current ?? defaultArrangement(this.#lanes().defaults);
	}

	/** The arrangement before the pending change (`null`: the default order); meaningful while `lastChange` is set. */
	get previous(): RowArrangement | null {
		return this.pending?.previous ?? null;
	}

	get lastChange(): ArrangementChange | null {
		return this.pending?.change ?? null;
	}

	/** «Схлопнуть всё» would change something: more than one lane. */
	get canCollapse(): boolean {
		return this.lanes.lanes.length > 1;
	}

	/** «Разделить всё» would change something: a lane of several members. */
	get canSplitAll(): boolean {
		return this.lanes.lanes.some((lane) => lane.members.length > 1);
	}

	/** «Сбросить порядок» would change something: the rows differ from the Scope tree as it is. */
	get canReset(): boolean {
		return !sameArrangement(this.lanes, defaultArrangement(this.#lanes().defaults));
	}

	reorder(from: number, to: number): void {
		this.#change('reorder', null, (lanes) => reorder(lanes, from, to));
	}

	merge(sourceLaneIndex: number, targetLaneIndex: number): void {
		// The target keeps its place, one higher once the source above it is gone.
		const merged = targetLaneIndex > sourceLaneIndex ? targetLaneIndex - 1 : targetLaneIndex;
		this.#change('merge', merged, (lanes) => merge(lanes, sourceLaneIndex, targetLaneIndex));
	}

	/** «×»: root members their own rows in place, claimed children back under their parents (review п. 32). */
	split(laneIndex: number): void {
		this.#change('split', null, (lanes) => split(lanes, laneIndex, this.#defaults()));
	}

	/** «↩» on a claimed child placed alone: back under its parent («возвращено»), taken back like any change. */
	unclaim(scopeId: string): void {
		this.#change('unclaim', null, (lanes) => unclaim(lanes, scopeId, this.#defaults()));
	}

	/** The Scope stands where the arrangement placed it, not under its parent: a claimed child (C2, D). */
	isClaimed(scopeId: string): boolean {
		return (
			!this.#defaults().has(scopeId) &&
			this.lanes.lanes.some((lane) => lane.members.includes(scopeId))
		);
	}

	/** A child Scope dropped on a lane joins it («слито»); dropped between lanes it becomes one («переставлено») (C2, D). */
	claim(scopeId: string, target: DropTarget): void {
		this.#change(
			target.kind === 'merge' ? 'merge' : 'reorder',
			target.kind === 'merge' ? target.index : null,
			(lanes) => claim(lanes, scopeId, target)
		);
	}

	rename(laneIndex: number, name: string | null): void {
		this.#change('rename', laneIndex, (lanes) => rename(lanes, laneIndex, name));
	}

	/** The chevron of a merged row (C5): its member rows beneath it, or folded away; no toast, no undo. */
	toggleExpanded(laneIndex: number): void {
		const lanes = this.lanes;
		const item = lanes.lanes[laneIndex];
		if (!item) return;
		const next = setExpanded(lanes, laneIndex, !item.expanded);
		if (next !== lanes) this.store.write(next);
	}

	/** «Схлопнуть всё»: the whole ribbon as one row (п. 7), taken back like any change. */
	collapseAll(): void {
		this.#change('collapse', null, collapseAll);
	}

	/** «Разделить всё»: every merged lane taken apart as «×» does, in the current order. */
	splitAll(): void {
		this.#change('splitAll', null, (lanes) => splitAll(lanes, this.#defaults()));
	}

	/** «Сбросить порядок»: the Scope tree as it is, owner names dropped; nothing when that is what shows. */
	reset(): void {
		if (this.canReset) this.#commit('reset', null, null);
	}

	/** Takes the pending change back; `false` when there is none. */
	undo(): boolean {
		const pending = this.pending;
		if (!pending) return false;
		this.store.write(pending.previous);
		this.dismiss();
		return true;
	}

	dismiss(): void {
		if (this.#timer) clearTimeout(this.#timer);
		this.#timer = null;
		this.pending = null;
	}

	/** The ids with a default lane of their own: root Scopes and «Без Scope»; a claimed child is none of them. */
	#defaults(): ReadonlySet<string> {
		// A transient lookup handed to pure operations, never stored in state — a plain Set is right here.
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		return new Set(this.#lanes().defaults);
	}

	/** An undoable change: nothing is written or offered when the operation left the lanes as they were. */
	#change(
		change: ArrangementChange,
		laneIndex: number | null,
		operation: (lanes: RowArrangement) => RowArrangement
	): void {
		const lanes = this.lanes;
		const next = operation(lanes);
		if (next !== lanes) this.#commit(change, laneIndex, next);
	}

	/** Writes the arrangement (`null`: the default order) and offers the one it replaced back for a while. */
	#commit(change: ArrangementChange, laneIndex: number | null, next: RowArrangement | null): void {
		const previous = this.store.read();
		this.store.write(next);
		this.dismiss();
		this.pending = { previous, change, laneIndex };
		this.#timer = setTimeout(() => this.dismiss(), this.#ttlMs);
	}
}
