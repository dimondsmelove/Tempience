import { describe, expect, it } from 'vitest';
import type { RibbonLayout, RowLayout } from '$lib/model/Layout/types';
import {
	cubicBezier,
	easeRowMove,
	ghostOffsetsAt,
	holdRows,
	motionRow,
	motionRows,
	offsetsAt,
	planGhosts,
	planMotion,
	shiftLayout
} from './RowMotion';

const row = (id: string, y0: number, scopeIds = [id]) => ({ id, scopeIds, y0 });

describe('the lanes’ glide when the driving lineup changes', () => {
	it('moves each row from where it stood; a row that stays does not move', () => {
		const plan = planMotion(
			[row('a', 0), row('b', 52), row('c', 104)],
			[row('c', 0), row('a', 52), row('b', 104)]
		);
		expect([...plan]).toEqual([
			['c', 104],
			['a', -52],
			['b', -52]
		]);
		expect(planMotion([row('a', 0)], [row('a', 0)]).size).toBe(0);
	});
	it('folds the rest into one row from the topmost member, and unfolds members from the merged row', () => {
		// Entering a chapter: b and c fold into «b+c», which glides from b's place.
		const folded = planMotion(
			[row('a', 0), row('b', 52), row('c', 104), row('t', 156)],
			[row('t', 0), row('a', 52), row('b+c', 104, ['b', 'c'])]
		);
		expect(folded.get('b+c')).toBe(-52);
		expect(folded.get('t')).toBe(156);
		// Leaving it: the members come out of the merged row's place.
		const unfolded = planMotion(
			[row('t', 0), row('a', 52), row('b+c', 104, ['b', 'c'])],
			[row('a', 0), row('b', 52), row('c', 104), row('t', 156)]
		);
		expect([...unfolded]).toEqual([
			['a', 52],
			['b', 52],
			['t', -156]
		]);
		// A row with no origin at all appears in place.
		expect(planMotion([row('a', 0)], [row('new', 52, [])]).size).toBe(0);
	});
	it('eases the rail’s curve: from the whole offset to none', () => {
		expect(easeRowMove(0)).toBe(0);
		expect(easeRowMove(1)).toBe(1);
		expect(easeRowMove(0.5)).toBeGreaterThan(0.8);
		expect(cubicBezier([0, 0, 1, 1])(0.3)).toBeCloseTo(0.3, 5);
		const plan = new Map([['a', 100]]);
		expect(offsetsAt(plan, 0).get('a')).toBe(100);
		expect(offsetsAt(plan, 1).get('a')).toBe(0);
		expect(offsetsAt(plan, 0.5).get('a')!).toBeLessThan(20);
	});
	it('shifts a moving row with its marks and captions, and leaves the others as they are', () => {
		const rowLayout = (id: string, y0: number) =>
			({
				row: { id, scopeIds: [id] },
				y0,
				y1: y0 + 52,
				boxes: [{ y0: y0 + 10, y1: y0 + 20 }],
				labels: [{ y: y0 + 30 }]
			}) as unknown as RowLayout;
		const layout = { rows: [rowLayout('a', 0), rowLayout('b', 52)] } as unknown as RibbonLayout;
		const shifted = shiftLayout(layout, new Map([['b', -26]]));
		expect(shifted.rows[0]).toBe(layout.rows[0]);
		expect(shifted.rows[1]).toMatchObject({
			y0: 26,
			y1: 78,
			boxes: [{ y0: 36, y1: 46 }],
			labels: [{ y: 56 }]
		});
		expect(motionRows(layout)).toEqual([
			{ id: 'a', scopeIds: ['a'], y0: 0 },
			{ id: 'b', scopeIds: ['b'], y0: 52 }
		]);
	});
	it('slides the members that fold away into the merged row, and lets them go when it ends', () => {
		// Entering a chapter: b and c fold into «b+c», now at 104; c travels from 104 (none), b from 52.
		const ghosts = planGhosts(
			[row('a', 0), row('b', 52), row('c', 156), row('t', 208)],
			[row('t', 0), row('a', 52), row('b+c', 104, ['b', 'c'])]
		);
		expect(ghosts).toEqual([
			{ id: 'b', dy: 52, into: 'b+c' },
			{ id: 'c', dy: -52, into: 'b+c' }
		]);
		expect(ghostOffsetsAt(ghosts, 0).get('b')).toBe(0);
		expect(ghostOffsetsAt(ghosts, 1).get('c')).toBe(-52);
		// A row that simply goes (nothing takes its Scopes in) is no ghost; nor is the unscoped row.
		expect(planGhosts([row('x', 0), row('u', 52, [])], [row('a', 0)])).toEqual([]);
	});

	// Owner review of PR #102: a group folds as it unfolds — its children slide into its row.
	const child = (id: string, y0: number, ancestorIds: string[]) => ({
		...row(id, y0),
		ancestorIds
	});
	const group = (id: string, y0: number, expanded: boolean, scopeIds = [id]) => ({
		...row(id, y0, scopeIds),
		...(expanded ? { expanded } : {})
	});
	it('folds a group’s children into its row, and unfolds them out of it', () => {
		const open = [
			group('lane', 0, true, ['p', 'q']),
			group('p', 52, true),
			child('c1', 104, ['p']),
			child('c2', 156, ['p']),
			group('q', 208, false)
		];
		const shut = [
			group('lane', 0, true, ['p', 'q']),
			group('p', 52, false),
			group('q', 104, false)
		];
		// The parent's own row takes them in, not the unfolded lane that also holds it.
		expect(planGhosts(open, shut)).toEqual([
			{ id: 'c1', dy: -52, into: 'p' },
			{ id: 'c2', dy: -104, into: 'p' }
		]);
		expect(planMotion(open, shut).get('q')).toBe(104);
		const unfolding = planMotion(shut, open);
		expect(unfolding.get('c1')).toBe(-52);
		expect(unfolding.get('c2')).toBe(-104);
		expect(unfolding.get('q')).toBe(-104);
	});
	it('a child hidden or shown under an unfolded parent neither folds nor comes out of it', () => {
		const before = [group('p', 0, true), child('c1', 52, ['p']), child('c2', 104, ['p'])];
		const after = [group('p', 0, true), child('c2', 52, ['p'])];
		expect(planGhosts(before, after)).toEqual([]);
		expect(planMotion(after, before).has('c1')).toBe(false);
	});
	it('reads a projected row’s ancestors and fold', () => {
		const projected = { id: 'c', scopeIds: ['c'], ancestorIds: ['p'], expanded: true };
		expect(motionRow(projected as never, 10)).toEqual({
			id: 'c',
			scopeIds: ['c'],
			y0: 10,
			ancestorIds: ['p'],
			expanded: true
		});
	});
	it('holds a row taking a fold in as it stood, at its new place, until the glide ends', () => {
		const rowLayout = (id: string, y0: number, marks: number) =>
			({
				row: { id, scopeIds: [id] },
				y0,
				y1: y0 + 52,
				boxes: Array.from({ length: marks }, () => ({ y0: y0 + 10, y1: y0 + 20 })),
				labels: []
			}) as unknown as RowLayout;
		const before = {
			rows: [rowLayout('p', 52, 1), rowLayout('c', 104, 2)]
		} as unknown as RibbonLayout;
		const after = { rows: [rowLayout('p', 0, 3)] } as unknown as RibbonLayout;
		const held = holdRows(before, after, new Set(['p']));
		expect(held.rows[0]).toMatchObject({ y0: 0, y1: 52, boxes: [{ y0: 10, y1: 20 }] });
		expect(holdRows(before, after, new Set())).toBe(after);
		expect(holdRows({ rows: [] } as unknown as RibbonLayout, after, new Set(['p'])).rows[0]).toBe(
			after.rows[0]
		);
	});
});
