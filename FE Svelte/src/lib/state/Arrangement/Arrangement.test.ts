import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
import type { LaneIds, RowArrangement } from '$lib/model/Arrangement/types';
import { ArrangementState, memoryArrangementStore } from './Arrangement.svelte';

const ids = (defaults: string[], extra: string[] = []): LaneIds => ({
	defaults,
	known: new Set([...defaults, ...extra])
});
const members = (arrangement: RowArrangement | null): string[][] | null =>
	arrangement ? arrangement.lanes.map((lane) => [...lane.members]) : null;

describe('ArrangementState: the device arrangement and its actions', () => {
	it('is the default order until an action writes, and spells the default out as lanes', () => {
		const state = new ArrangementState(() => ids(['a', 'b', UNSCOPED_ROW_ID]));
		expect(state.current).toBeNull();
		expect(members(state.lanes)).toEqual([['a'], ['b'], [UNSCOPED_ROW_ID]]);
	});

	it('actions act on the visible lanes and write the whole arrangement to the store', () => {
		const state = new ArrangementState(() => ids(['a', 'b', 'c', UNSCOPED_ROW_ID], ['child']));
		const store = state.store;
		state.merge(1, 0);
		expect(members(store.read())).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.reorder(1, 0);
		expect(members(state.current)).toEqual([['c'], ['a', 'b'], [UNSCOPED_ROW_ID]]);
		state.rename(1, 'Дела');
		expect(state.current?.lanes[1].name).toBe('Дела');
		state.split(1);
		expect(members(state.current)).toEqual([['c'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		state.claim('child', { kind: 'merge', index: 1 });
		expect(members(state.current)).toEqual([['c'], ['a', 'child'], ['b'], [UNSCOPED_ROW_ID]]);
		expect(state.isClaimed('child')).toBe(true);
		// «×» returns the child under its parent (review 2026-09-19, п. 32); placed, it is not claimed twice.
		state.split(1);
		expect(members(state.current)).toEqual([['c'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		expect(state.isClaimed('child')).toBe(false);
		state.claim('child', { kind: 'insert', index: 0 });
		expect(members(state.current)).toEqual([['child'], ['c'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		state.claim('child', { kind: 'insert', index: 2 });
		expect(members(state.current)).toEqual([['child'], ['c'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		state.collapseAll();
		expect(members(state.current)).toEqual([['child', 'c', 'a', 'b', UNSCOPED_ROW_ID]]);
		// «Разделить всё» sends the child home too; a root is never «claimed».
		state.splitAll();
		expect(members(state.current)).toEqual([['c'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		expect(state.isClaimed('a')).toBe(false);
		// «↩» on a child placed alone: back under its parent, the lane gone.
		state.claim('child', { kind: 'insert', index: 1 });
		expect(members(state.current)).toEqual([['c'], ['child'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		state.unclaim('child');
		expect(members(state.current)).toEqual([['c'], ['a'], ['b'], [UNSCOPED_ROW_ID]]);
		state.reset();
		expect(store.read()).toBeNull();
		expect(members(state.lanes)).toEqual([['a'], ['b'], ['c'], [UNSCOPED_ROW_ID]]);
	});

	it('fits the saved arrangement to the Scopes at hand before showing or acting on it', () => {
		const store = memoryArrangementStore();
		store.write({ lanes: [{ members: ['gone', 'b'] }, { members: ['a'] }] });
		let lanes = ids(['a', 'b', UNSCOPED_ROW_ID]);
		const state = new ArrangementState(() => lanes);
		state.store = store;
		expect(members(state.current)).toEqual([['b'], ['a'], [UNSCOPED_ROW_ID]]);
		// A Scope made later joins at the end; the store is untouched until an action.
		lanes = ids(['a', 'b', 'new', UNSCOPED_ROW_ID]);
		expect(members(state.current)).toEqual([['b'], ['a'], ['new'], [UNSCOPED_ROW_ID]]);
		expect(members(store.read())).toEqual([['gone', 'b'], ['a']]);
		state.merge(2, 0);
		expect(members(store.read())).toEqual([['b', 'new'], ['a'], [UNSCOPED_ROW_ID]]);
	});
});

describe('ArrangementState: one level of undo (Q4-A)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());
	const make = (): ArrangementState =>
		new ArrangementState(() => ids(['a', 'b', 'c', UNSCOPED_ROW_ID], ['child']), 6000);

	it('a merge keeps the arrangement it replaced — the default order too — and undo writes it back', () => {
		const state = make();
		expect(state.pending).toBeNull();
		state.merge(1, 0);
		expect(state.lastChange).toBe('merge');
		expect(state.previous).toBeNull();
		expect(state.pending?.laneIndex).toBe(0);
		expect(state.undo()).toBe(true);
		expect(state.store.read()).toBeNull();
		expect(members(state.lanes)).toEqual([['a'], ['b'], ['c'], [UNSCOPED_ROW_ID]]);
		expect([state.pending, state.undo()]).toEqual([null, false]);
	});

	it('names the merged lane where it stands after the merge, and the claimed lane', () => {
		const state = make();
		// The source above the target leaves: the target is one lane higher.
		state.merge(0, 2);
		expect(members(state.lanes)).toEqual([['b'], ['c', 'a'], [UNSCOPED_ROW_ID]]);
		expect(state.pending?.laneIndex).toBe(1);
		state.claim('child', { kind: 'merge', index: 0 });
		expect(state.pending).toMatchObject({ change: 'merge', laneIndex: 0 });
		expect(members(state.previous)).toEqual([['b'], ['c', 'a'], [UNSCOPED_ROW_ID]]);
		state.undo();
		state.claim('child', { kind: 'insert', index: 0 });
		expect(state.pending).toMatchObject({ change: 'reorder', laneIndex: null });
		// «↩» is a change of its own, taken back like the rest; on a root it does nothing and offers nothing.
		state.unclaim('child');
		expect(state.pending).toMatchObject({ change: 'unclaim', laneIndex: null });
		expect(members(state.lanes)).toEqual([['b'], ['c', 'a'], [UNSCOPED_ROW_ID]]);
		expect(state.undo()).toBe(true);
		expect(members(state.lanes)).toEqual([['child'], ['b'], ['c', 'a'], [UNSCOPED_ROW_ID]]);
		state.unclaim('b');
		expect(state.pending).toBeNull();
	});

	it('every change replaces the pending one: one level, the last change only', () => {
		const state = make();
		state.merge(1, 0);
		state.reorder(1, 0);
		expect(state.lastChange).toBe('reorder');
		expect(members(state.previous)).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.rename(1, 'Дела');
		expect(state.pending).toMatchObject({ change: 'rename', laneIndex: 1 });
		state.split(1);
		expect(state.lastChange).toBe('split');
		state.undo();
		expect(members(state.lanes)).toEqual([['c'], ['a', 'b'], [UNSCOPED_ROW_ID]]);
		expect(state.lanes.lanes[1].name).toBe('Дела');
		// Undone is undone: the change before the last is not offered.
		expect(state.pending).toBeNull();
	});

	it('the offer fades after its time; a change that does nothing offers nothing', () => {
		const state = make();
		state.merge(1, 0);
		vi.advanceTimersByTime(5999);
		expect(state.lastChange).toBe('merge');
		vi.advanceTimersByTime(1);
		expect(state.pending).toBeNull();
		expect(state.undo()).toBe(false);
		expect(members(state.lanes)).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.reorder(0, 0);
		state.merge(9, 0);
		state.claim('a', { kind: 'merge', index: 1 });
		expect(state.pending).toBeNull();
	});

	it('the «⋯» menu changes are offered back too: collapse, split all, reset (C3)', () => {
		const state = make();
		state.merge(1, 0);
		state.collapseAll();
		expect(state.pending).toMatchObject({ change: 'collapse', laneIndex: null });
		expect(members(state.lanes)).toEqual([['a', 'b', 'c', UNSCOPED_ROW_ID]]);
		expect(members(state.previous)).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.undo();
		expect(members(state.lanes)).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.splitAll();
		expect(state.lastChange).toBe('splitAll');
		expect(members(state.lanes)).toEqual([['a'], ['b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.undo();
		state.reorder(2, 0);
		state.reset();
		expect(state.lastChange).toBe('reset');
		expect(state.store.read()).toBeNull();
		expect(members(state.lanes)).toEqual([['a'], ['b'], ['c'], [UNSCOPED_ROW_ID]]);
		// Undo of the reset brings the arranged rows back, merge and order alike.
		expect(state.undo()).toBe(true);
		expect(members(state.lanes)).toEqual([[UNSCOPED_ROW_ID], ['a', 'b'], ['c']]);
	});

	it('the fold of a merged lane (C5) is written without an offer, and an undo of the change before it restores the fold that change saw', () => {
		const state = make();
		state.merge(1, 0);
		expect(state.lanes.lanes[0].expanded).toBeUndefined();
		state.toggleExpanded(0);
		expect(state.lanes.lanes[0]).toEqual({ members: ['a', 'b'], expanded: true });
		expect(members(state.store.read())).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		// The merge is still the pending change; taking it back returns the rows before it.
		expect(state.lastChange).toBe('merge');
		expect(state.undo()).toBe(true);
		expect(members(state.lanes)).toEqual([['a'], ['b'], ['c'], [UNSCOPED_ROW_ID]]);
		// A rename after the fold keeps it; its undo brings the unfolded lane back as it was.
		state.merge(1, 0);
		state.dismiss();
		state.toggleExpanded(0);
		state.rename(0, 'Дом');
		expect(state.lanes.lanes[0]).toEqual({ members: ['a', 'b'], name: 'Дом', expanded: true });
		state.undo();
		expect(state.lanes.lanes[0]).toEqual({ members: ['a', 'b'], expanded: true });
		state.toggleExpanded(0);
		expect(state.lanes.lanes[0]).toEqual({ members: ['a', 'b'] });
		// A plain lane or a stale index: nothing written, nothing offered.
		state.dismiss();
		state.toggleExpanded(1);
		state.toggleExpanded(9);
		expect(state.pending).toBeNull();
		expect(members(state.lanes)).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
	});

	it('the menu knows when an item would do nothing, and such an item offers nothing', () => {
		const state = make();
		expect([state.canCollapse, state.canSplitAll, state.canReset]).toEqual([true, false, false]);
		state.splitAll();
		state.reset();
		expect(state.pending).toBeNull();
		state.merge(1, 0);
		expect([state.canCollapse, state.canSplitAll, state.canReset]).toEqual([true, true, true]);
		state.collapseAll();
		expect([state.canCollapse, state.canSplitAll, state.canReset]).toEqual([false, true, true]);
		state.collapseAll();
		expect(state.lastChange).toBe('collapse');
		expect(members(state.previous)).toEqual([['a', 'b'], ['c'], [UNSCOPED_ROW_ID]]);
		state.splitAll();
		expect([state.canCollapse, state.canSplitAll, state.canReset]).toEqual([true, false, false]);
		// Split back into the default order, but saved: nothing to reset, and reset says so.
		expect(state.store.read()).not.toBeNull();
		state.reset();
		expect(state.lastChange).toBe('splitAll');
		// An owner name is a difference from the default too; «×» drops it with the merge.
		state.merge(1, 0);
		state.rename(0, 'Дом');
		expect(state.canReset).toBe(true);
		state.split(0);
		expect(state.canReset).toBe(false);
	});
});
