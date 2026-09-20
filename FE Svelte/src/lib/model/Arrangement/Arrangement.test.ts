import { describe, expect, it } from 'vitest';
import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
import {
	claim,
	collapseAll,
	defaultArrangement,
	laneIds,
	laneIndexOf,
	laneName,
	merge,
	mergedRowId,
	parseArrangement,
	reconcile,
	rename,
	reorder,
	sameArrangement,
	setExpanded,
	split,
	splitAll,
	unclaim
} from './Arrangement';
import type { RowArrangement } from './types';

const base = defaultArrangement(['belgrade', 'work', 'people', UNSCOPED_ROW_ID]);
/** The ids with a default lane: the roots and «Без Scope»; «project» is a child of «work» and has none. */
const roots = new Set(['belgrade', 'work', 'people', UNSCOPED_ROW_ID]);
const members = (arrangement: RowArrangement): string[][] =>
	arrangement.lanes.map((lane) => [...lane.members]);

describe('row arrangement operations (research п. 7, Q1–Q3)', () => {
	it('starts with every id as its own lane, in order', () => {
		expect(members(base)).toEqual([['belgrade'], ['work'], ['people'], [UNSCOPED_ROW_ID]]);
		expect(base.lanes.every((lane) => lane.name === undefined)).toBe(true);
	});

	it('reorder moves one lane to the given place and ignores a stale index', () => {
		expect(members(reorder(base, 2, 0))).toEqual([
			['people'],
			['belgrade'],
			['work'],
			[UNSCOPED_ROW_ID]
		]);
		expect(members(reorder(base, 0, 3))).toEqual([
			['work'],
			['people'],
			[UNSCOPED_ROW_ID],
			['belgrade']
		]);
		expect(reorder(base, 1, 1)).toBe(base);
		expect(reorder(base, 7, 0)).toBe(base);
		expect(reorder(base, 0, -1)).toBe(base);
	});

	it('merge folds the source into the target, which keeps its place and name; members never repeat', () => {
		const named = rename(base, 0, 'Жизнь');
		const merged = merge(named, 2, 0);
		expect(members(merged)).toEqual([['belgrade', 'people'], ['work'], [UNSCOPED_ROW_ID]]);
		expect(merged.lanes[0].name).toBe('Жизнь');
		// A merge of overlapping sets: the target's order first, the new members after.
		const again = merge(merge(base, 1, 0), 0, 1);
		expect(members(again)).toEqual([['people', 'belgrade', 'work'], [UNSCOPED_ROW_ID]]);
		expect(merge(base, 0, 0)).toBe(base);
		expect(merge(base, 9, 0)).toBe(base);
	});

	it('split returns the members as single lanes in place, in their order, without the name', () => {
		const merged = merge(base, 2, 1);
		expect(members(merged)).toEqual([['belgrade'], ['work', 'people'], [UNSCOPED_ROW_ID]]);
		const back = split(rename(merged, 1, 'Дела'), 1, roots);
		expect(members(back)).toEqual([['belgrade'], ['work'], ['people'], [UNSCOPED_ROW_ID]]);
		expect(back.lanes.map((lane) => lane.name)).toEqual([
			undefined,
			undefined,
			undefined,
			undefined
		]);
		expect(split(base, 0, roots)).toEqual(base);
		expect(split(base, 4, roots)).toBe(base);
	});

	it('split and splitAll return a claimed child to its parent instead of making it a root row (review 2026-09-19, п. 32)', () => {
		// «project» claimed into Белград's lane: «×» leaves Белград alone in place; the child is no lane.
		const claimed = claim(base, 'project', { kind: 'merge', index: 0 });
		expect(members(split(claimed, 0, roots))).toEqual([
			['belgrade'],
			['work'],
			['people'],
			[UNSCOPED_ROW_ID]
		]);
		// A lane of claimed children only leaves altogether.
		const children = claim(claim(base, 'project', { kind: 'insert', index: 1 }), 'sprint', {
			kind: 'merge',
			index: 1
		});
		expect(members(children)).toEqual([
			['belgrade'],
			['project', 'sprint'],
			['work'],
			['people'],
			[UNSCOPED_ROW_ID]
		]);
		expect(members(split(children, 1, roots))).toEqual(members(base));
		// «Разделить всё»: merged lanes come apart the same way; a child placed alone stays a lane.
		const mixed = claim(merge(claimed, 2, 1), 'sprint', { kind: 'insert', index: 3 });
		expect(members(mixed)).toEqual([
			['belgrade', 'project'],
			['work', 'people'],
			[UNSCOPED_ROW_ID],
			['sprint']
		]);
		expect(members(splitAll(mixed, roots))).toEqual([
			['belgrade'],
			['work'],
			['people'],
			[UNSCOPED_ROW_ID],
			['sprint']
		]);
	});

	it('unclaim takes a claimed child out of its lane — the lane goes when it was alone; roots and strangers change nothing', () => {
		const alone = claim(base, 'project', { kind: 'insert', index: 0 });
		expect(members(unclaim(alone, 'project', roots))).toEqual(members(base));
		const inside = rename(claim(base, 'project', { kind: 'merge', index: 1 }), 1, 'Дела');
		const out = unclaim(inside, 'project', roots);
		expect(members(out)).toEqual(members(base));
		expect(out.lanes[1].name).toBe('Дела');
		expect(unclaim(base, 'work', roots)).toBe(base);
		expect(unclaim(base, 'project', roots)).toBe(base);
	});

	it('claim places a child Scope: into a lane on «merge», as its own lane on «insert»; a placed Scope stays (C2, D)', () => {
		// «project» is a child of «work»: shown under it, no lane of its own.
		const onto = claim(rename(base, 0, 'Жизнь'), 'project', { kind: 'merge', index: 0 });
		expect(members(onto)).toEqual([
			['belgrade', 'project'],
			['work'],
			['people'],
			[UNSCOPED_ROW_ID]
		]);
		expect(onto.lanes[0].name).toBe('Жизнь');
		expect(members(claim(base, 'project', { kind: 'insert', index: 1 }))).toEqual([
			['belgrade'],
			['project'],
			['work'],
			['people'],
			[UNSCOPED_ROW_ID]
		]);
		expect(members(claim(base, 'project', { kind: 'insert', index: 4 }))).toEqual([
			['belgrade'],
			['work'],
			['people'],
			[UNSCOPED_ROW_ID],
			['project']
		]);
		// Already a member somewhere: the lanes are what they are; so for a target out of range.
		expect(claim(base, 'work', { kind: 'merge', index: 0 })).toBe(base);
		expect(claim(base, 'project', { kind: 'merge', index: 4 })).toBe(base);
		expect(claim(base, 'project', { kind: 'insert', index: 5 })).toBe(base);
		expect(claim(base, 'project', { kind: 'insert', index: -1 })).toBe(base);
	});

	it('collapseAll makes one lane of everything; splitAll undoes it in lane order; neither touches what it cannot change', () => {
		const one = collapseAll(merge(base, 3, 1));
		expect(members(one)).toEqual([['belgrade', 'work', UNSCOPED_ROW_ID, 'people']]);
		expect(members(splitAll(one, roots))).toEqual([
			['belgrade'],
			['work'],
			[UNSCOPED_ROW_ID],
			['people']
		]);
		// Everything merges into the first lane, which keeps its owner name as a merge target does.
		expect(one.lanes[0].name).toBeUndefined();
		expect(collapseAll(rename(base, 0, 'Жизнь')).lanes[0].name).toBe('Жизнь');
		expect(collapseAll(rename(base, 1, 'Дела')).lanes[0].name).toBeUndefined();
		// One lane already, nothing merged, no lanes at all: the same value back, so the menu can tell a no-op.
		expect(collapseAll(one)).toBe(one);
		expect(splitAll(base, roots)).toBe(base);
		const empty = { lanes: [] };
		expect(collapseAll(empty)).toBe(empty);
		expect(splitAll(empty, roots)).toBe(empty);
	});

	it('sameArrangement compares members in order and owner names', () => {
		expect(
			sameArrangement(base, defaultArrangement(['belgrade', 'work', 'people', UNSCOPED_ROW_ID]))
		).toBe(true);
		expect(sameArrangement(base, reorder(base, 0, 1))).toBe(false);
		expect(sameArrangement(base, merge(base, 1, 0))).toBe(false);
		expect(sameArrangement(base, rename(base, 0, 'Дом'))).toBe(false);
		expect(sameArrangement(splitAll(collapseAll(base), roots), base)).toBe(true);
	});

	it('rename sets, trims and clears the owner name', () => {
		expect(rename(base, 1, '  Дела ').lanes[1].name).toBe('Дела');
		expect(rename(rename(base, 1, 'Дела'), 1, null).lanes[1]).toEqual({ members: ['work'] });
		expect(rename(rename(base, 1, 'Дела'), 1, '   ').lanes[1].name).toBeUndefined();
		expect(rename(base, 5, 'x')).toBe(base);
	});

	it('names a lane after its first member with «+N», or by the owner name (Q1-A)', () => {
		const scopes = new Map([
			['belgrade', { name: 'Белград' }],
			['people', { name: 'Люди' }]
		]);
		expect(laneName({ members: ['belgrade'] }, scopes)).toBe('Белград');
		expect(laneName({ members: ['belgrade', 'people'] }, scopes)).toBe('Белград +1');
		expect(laneName({ members: ['people', 'belgrade', 'work'] }, scopes)).toBe('Люди +2');
		expect(laneName({ members: ['belgrade', 'people'], name: 'Жизнь' }, scopes)).toBe('Жизнь');
		// An unknown first member falls back to its id rather than throwing.
		expect(laneName({ members: ['gone'] }, scopes)).toBe('gone');
	});

	it('reconcile drops vanished members and repeats, and appends new default lanes at the end', () => {
		const saved: RowArrangement = {
			lanes: [
				{ members: ['belgrade', 'gone', 'work'], name: 'Жизнь' },
				{ members: ['gone'] },
				{ members: ['work', 'people'] }
			]
		};
		const fitted = reconcile(saved, {
			defaults: ['belgrade', 'work', 'people', 'health', UNSCOPED_ROW_ID],
			known: new Set(['belgrade', 'work', 'people', 'health', 'project', UNSCOPED_ROW_ID])
		});
		expect(members(fitted)).toEqual([
			['belgrade', 'work'],
			['people'],
			['health'],
			[UNSCOPED_ROW_ID]
		]);
		expect(fitted.lanes[0].name).toBe('Жизнь');
		// A child Scope claimed by a lane stays there; one never placed is not a default lane.
		const child = reconcile(
			{ lanes: [{ members: ['belgrade', 'project'] }] },
			{ defaults: ['belgrade', 'work'], known: new Set(['belgrade', 'work', 'project']) }
		);
		expect(members(child)).toEqual([['belgrade', 'project'], ['work']]);
		expect(reconcile({ lanes: [] }, { defaults: ['a'], known: new Set(['a']) })).toEqual(
			defaultArrangement(['a'])
		);
	});

	it('mergedRowId joins the members', () => {
		expect(mergedRowId(['belgrade', 'work'])).toBe('belgrade+work');
	});

	it('laneIds lists the roots in snapshot order, then «Без Scope», and knows every Scope', () => {
		const origin = { kind: 'canonical' as const, sourceId: 'test' };
		const scope = (id: string) => ({
			id,
			name: id,
			note: null,
			startedAt: null,
			endedAt: null,
			colorHue: null,
			colorChroma: null,
			origin
		});
		const ids = laneIds({
			scopes: [scope('work'), scope('project'), scope('belgrade')],
			intersections: [
				{ id: 'l', fromId: 'project', toId: 'work', kind: 'child_of', context: null, origin }
			]
		});
		expect(ids.defaults).toEqual(['work', 'belgrade', UNSCOPED_ROW_ID]);
		expect([...ids.known].sort()).toEqual([UNSCOPED_ROW_ID, 'belgrade', 'project', 'work']);
	});

	it('laneIndexOf finds the lane by any member, or −1', () => {
		const merged = merge(base, 2, 1);
		expect(laneIndexOf(merged, 'people')).toBe(1);
		expect(laneIndexOf(merged, 'work')).toBe(1);
		expect(laneIndexOf(merged, UNSCOPED_ROW_ID)).toBe(2);
		expect(laneIndexOf(merged, 'project')).toBe(-1);
	});
});

describe('the fold of a merged lane (loop 008, C5)', () => {
	const merged = merge(base, 2, 1);
	const open = setExpanded(merged, 1, true);

	it('setExpanded unfolds and folds a merged lane, keeps its name, and leaves a plain lane or a stale index alone', () => {
		expect(open.lanes[1]).toEqual({ members: ['work', 'people'], expanded: true });
		expect(setExpanded(open, 1, true)).toBe(open);
		expect(setExpanded(open, 1, false).lanes[1]).toEqual({ members: ['work', 'people'] });
		expect(setExpanded(merged, 1, false)).toBe(merged);
		expect(setExpanded(merged, 0, true)).toBe(merged);
		expect(setExpanded(merged, 9, true)).toBe(merged);
		expect(setExpanded(rename(merged, 1, 'Дела'), 1, true).lanes[1]).toEqual({
			members: ['work', 'people'],
			name: 'Дела',
			expanded: true
		});
	});

	it('a lane merged for the first time stands folded; a merged lane keeps its fold through a merge, a claim, a rename and a reorder', () => {
		expect(merge(base, 1, 0).lanes[0].expanded).toBeUndefined();
		expect(merge(open, 0, 1).lanes[0]).toEqual({
			members: ['work', 'people', 'belgrade'],
			expanded: true
		});
		expect(claim(open, 'project', { kind: 'merge', index: 1 }).lanes[1]).toEqual({
			members: ['work', 'people', 'project'],
			expanded: true
		});
		expect(rename(open, 1, 'Дела').lanes[1].expanded).toBe(true);
		expect(reorder(open, 1, 0).lanes[0].expanded).toBe(true);
		// A plain lane claimed into stands folded, as a merge does.
		expect(claim(base, 'project', { kind: 'merge', index: 0 }).lanes[0].expanded).toBeUndefined();
	});

	it('split, splitAll and collapseAll leave nothing unfolded; unclaim keeps the fold while members remain', () => {
		expect(split(open, 1, roots).lanes.every((item) => item.expanded === undefined)).toBe(true);
		expect(splitAll(open, roots).lanes.every((item) => item.expanded === undefined)).toBe(true);
		expect(collapseAll(open).lanes[0].expanded).toBeUndefined();
		const three = setExpanded(claim(open, 'project', { kind: 'merge', index: 1 }), 1, true);
		expect(unclaim(three, 'project', roots).lanes[1]).toEqual({
			members: ['work', 'people'],
			expanded: true
		});
		// Down to one member, the fold goes with the merge.
		const pair = setExpanded(claim(base, 'project', { kind: 'merge', index: 0 }), 0, true);
		expect(unclaim(pair, 'project', roots).lanes[0]).toEqual({ members: ['belgrade'] });
	});

	it('reconcile keeps the fold of a lane still merged and drops it from one left with a member', () => {
		const fitted = reconcile(
			{
				lanes: [
					{ members: ['belgrade', 'work'], expanded: true },
					{ members: ['people', 'gone'], expanded: true }
				]
			},
			{
				defaults: ['belgrade', 'work', 'people', UNSCOPED_ROW_ID],
				known: new Set(['belgrade', 'work', 'people', UNSCOPED_ROW_ID])
			}
		);
		expect(fitted.lanes).toEqual([
			{ members: ['belgrade', 'work'], expanded: true },
			{ members: ['people'] },
			{ members: [UNSCOPED_ROW_ID] }
		]);
	});

	it('sameArrangement reads the rows, not the fold', () => {
		expect(sameArrangement(merged, open)).toBe(true);
	});
});

describe('parseArrangement', () => {
	it('accepts a well-formed arrangement and copies only its own fields', () => {
		const parsed = parseArrangement({
			lanes: [{ members: ['a', 'b'], name: 'AB', extra: 1 }, { members: ['c'] }],
			extra: true
		});
		expect(parsed).toEqual({ lanes: [{ members: ['a', 'b'], name: 'AB' }, { members: ['c'] }] });
	});

	it('reads the fold of a merged lane (C5); a folded or a plain lane carries none', () => {
		expect(
			parseArrangement({
				lanes: [
					{ members: ['a', 'b'], expanded: true },
					{ members: ['c', 'd'], expanded: false },
					{ members: ['e'], expanded: true }
				]
			})
		).toEqual({
			lanes: [{ members: ['a', 'b'], expanded: true }, { members: ['c', 'd'] }, { members: ['e'] }]
		});
		expect(parseArrangement({ lanes: [{ members: ['a', 'b'], expanded: 'yes' }] })).toBeNull();
	});

	it('refuses anything malformed', () => {
		expect(parseArrangement(null)).toBeNull();
		expect(parseArrangement([])).toBeNull();
		expect(parseArrangement({})).toBeNull();
		expect(parseArrangement({ lanes: 'x' })).toBeNull();
		expect(parseArrangement({ lanes: [{ members: [] }] })).toBeNull();
		expect(parseArrangement({ lanes: [{ members: ['a', 2] }] })).toBeNull();
		expect(parseArrangement({ lanes: [{ members: ['a'], name: 3 }] })).toBeNull();
		expect(parseArrangement({ lanes: [{ members: ['a'], name: 'x'.repeat(81) }] })).toBeNull();
		expect(parseArrangement({ lanes: [null] })).toBeNull();
	});
});
