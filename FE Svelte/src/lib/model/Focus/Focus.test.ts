import { describe, expect, it } from 'vitest';
import { DAY, links, row, rows, sorted, view } from '$lib/model/Lens/fixture';
import { lensSet } from '$lib/model/Lens/Lens';
import { EMPTY_FOCUS, focusSet, unionLit } from './Focus';

describe('focusSet: what the Context keeps lit on the ribbon (loop 008, A)', () => {
	it('nothing at rest and nothing beyond the selection for a record', () => {
		expect(focusSet(null, rows, view)).toBe(EMPTY_FOCUS);
		expect(focusSet({ kind: 'trace', traceId: 'course' }, rows, view)).toBe(EMPTY_FOCUS);
	});

	it('a period tints its column and lights every record touching it, wherever it projects', () => {
		const focus = focusSet(
			{ kind: 'period', range: { start: 30 * DAY, end: 40 * DAY } },
			rows,
			view
		);
		expect(sorted(focus.traceIds)).toEqual(['course', 'interview', 'offer', 'sprint']);
		expect([...focus.rowIds]).toEqual(['belgrade', 'work']);
		expect(focus.range).toEqual({ start: 30 * DAY, end: 40 * DAY });
	});

	it('a Scope lights its records with the subtree and names its row', () => {
		const focus = focusSet({ kind: 'scope', scopeId: 'work' }, rows, view);
		expect(sorted(focus.traceIds)).toEqual(['interview', 'offer', 'sprint', 'trial']);
		expect([...focus.rowIds]).toEqual(['work']);
		expect(focus.range).toBeNull();
	});

	it('a merged row (C5) lights every record it draws and names itself alone; an unknown row nothing', () => {
		const merged = row('belgrade+work', [...rows[0].marks, ...rows[1].marks], {
			kind: 'merged',
			scopeId: null,
			scopeIds: ['belgrade', 'work']
		});
		const focus = focusSet({ kind: 'row', rowId: 'belgrade+work' }, [merged, ...rows], view);
		expect(sorted(focus.traceIds)).toEqual([
			'course',
			'interview',
			'move',
			'offer',
			'sprint',
			'trial'
		]);
		expect([...focus.rowIds]).toEqual(['belgrade+work']);
		expect(focus.range).toBeNull();
		expect(focusSet({ kind: 'row', rowId: 'gone' }, rows, view)).toBe(EMPTY_FOCUS);
	});

	it('an explicit link lights both its ends; a Scope end by its records; an unknown link nothing', () => {
		const focus = focusSet(
			{ kind: 'intersection', intersectionId: 'l:course-interview' },
			rows,
			view
		);
		expect(sorted(focus.traceIds)).toEqual(['course', 'interview']);
		expect([...focus.rowIds]).toEqual(['belgrade', 'work']);
		const membership = focusSet(
			{ kind: 'intersection', intersectionId: 'i:interview' },
			rows,
			view
		);
		expect(sorted(membership.traceIds)).toEqual(['interview', 'sprint', 'trial']);
		expect(focusSet({ kind: 'intersection', intersectionId: 'gone' }, rows, view)).toBe(
			EMPTY_FOCUS
		);
	});
});

describe('unionLit', () => {
	it('returns the other side when one is empty, else the union of both', () => {
		const focus = focusSet({ kind: 'scope', scopeId: 'work' }, rows, view);
		const lens = lensSet({ kind: 'trace', traceId: 'move' }, rows, links, view);
		expect(unionLit(EMPTY_FOCUS, lens)).toBe(lens);
		expect(unionLit(focus, EMPTY_FOCUS)).toBe(focus);
		const both = unionLit(focus, lens);
		expect(sorted(both.traceIds)).toEqual([
			'course',
			'interview',
			'move',
			'offer',
			'sprint',
			'trial'
		]);
		expect(sorted(both.rowIds)).toEqual(['belgrade', 'work']);
	});
});
