import type { ScopeColour } from '$lib/theme/scope-colour';
import { describe, expect, it } from 'vitest';
import type {
	ExplorerIntersection,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import type { TraceAboutTime, TraceRelation } from '$lib/state/triplit/types';
import { defaultArrangement, laneIds } from '$lib/model/Arrangement/Arrangement';
import { markColours } from '$lib/model/MarkStyle/MarkStyle';
import { lensSet } from '$lib/model/Lens/Lens';
import { EMPTY_PROJECTION_STATE, UNSCOPED_ROW_ID } from './constants';
import { projectSnapshot } from './Projection';
import type { ProjectionState } from './types';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const scope = (
	id: string,
	colorHue: number | null = null,
	colorChroma: number | null = null
): ExplorerScope => ({
	id,
	name: id.toUpperCase(),
	note: null,
	startedAt: null,
	endedAt: null,
	colorHue,
	colorChroma,
	origin
});
const trace = (
	id: string,
	aboutKind: ExplorerTrace['aboutKind'],
	aboutTime: TraceAboutTime | null,
	relation: TraceRelation = 'actual'
): ExplorerTrace => ({
	id,
	content: `Запись ${id}`,
	relation,
	timezone: 'UTC',
	aboutKind,
	aboutTime,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin
});
const link = (fromId: string, toId: string, kind: ExplorerIntersection['kind']) => ({
	id: `${kind}:${fromId}:${toId}`,
	fromId,
	toId,
	kind,
	context: null,
	origin
});
const absolute = (
	start: string,
	precision: 'minute' | 'day' | 'month' | 'year' = 'day',
	end: string | null = null
): TraceAboutTime => ({ basis: 'absolute', precision, certainty: 'exact', start, end });

/**
 * A (hue 1) is a group with the child B (hue 5); C (colourless) is empty. t1, t4 are A's;
 * t2 is in A and B; t3 is B's; t6 has no Scope; t5 is parked (relative).
 */
const snapshot: ExplorerSnapshot = {
	scopes: [scope('a', 1), scope('b', 5), scope('c')],
	traces: [
		trace('t1', 'instant', absolute('2026-03-10')),
		trace('t2', 'interval', absolute('2026-03-01', 'day', '2026-03-05')),
		trace('t3', 'instant', absolute('2026-04', 'month')),
		trace('t4', 'instant', absolute('2026-05-01'), 'intend'),
		trace('t5', 'instant', {
			basis: 'relative',
			precision: 'day',
			anchorTraceId: 't1',
			relation: 'after'
		}),
		trace('t6', 'instant', absolute('2026-06-01'))
	],
	periods: [],
	intersections: [
		link('b', 'a', 'child_of'),
		link('t1', 'a', 'belongs_to'),
		link('t2', 'a', 'belongs_to'),
		link('t2', 'b', 'belongs_to'),
		link('t3', 'b', 'belongs_to'),
		link('t4', 'a', 'belongs_to'),
		link('t5', 'b', 'belongs_to')
	],
	scopeSegments: []
};
const now = Date.UTC(2026, 8, 6, 12);
const state = (patch: Partial<ProjectionState> = {}): ProjectionState => ({
	...EMPTY_PROJECTION_STATE,
	now,
	...patch
});
const lanes = (...members: string[][]) => ({ lanes: members.map((ids) => ({ members: ids })) });
const palette = { ink: 'ink', scope: (colour: ScopeColour) => `s${colour.hue}` };
const c = (hue: number, chroma: number | null = null): ScopeColour => ({ hue, chroma, depth: 0 });

describe('projectSnapshot with a row arrangement (research п. 7, Q1–Q3)', () => {
	it('without an arrangement the rows are exactly those of the Scope tree, and so are the default lanes', () => {
		const plain = projectSnapshot(snapshot, state());
		expect(projectSnapshot(snapshot, state({ arrangement: null }))).toEqual(plain);
		expect(
			projectSnapshot(
				snapshot,
				state({ arrangement: defaultArrangement(laneIds(snapshot).defaults) })
			)
		).toEqual(plain);
		expect(plain.rows.map((row) => row.id)).toEqual(['a', 'c', UNSCOPED_ROW_ID]);
		// The set fields of a plain row and of «Без Scope».
		expect(plain.rows[0]).toMatchObject({ kind: 'scope', scopeIds: ['a'], colours: [c(1)] });
		expect(plain.rows[1]).toMatchObject({ scopeIds: ['c'], colours: [] });
		expect(plain.rows[2]).toMatchObject({ kind: 'unscoped', scopeIds: [], colours: [] });
		expect(plain.rows[0].marks.every((mark) => mark.colours === undefined)).toBe(true);
	});

	it('emits the rows in lane order and merges a lane of several Scopes into one row', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes([UNSCOPED_ROW_ID], ['c', 'a']) })
		);
		expect(projection.rows.map((row) => row.id)).toEqual([UNSCOPED_ROW_ID, 'c+a']);
		const merged = projection.rows[1];
		expect(merged).toMatchObject({
			kind: 'merged',
			scopeId: null,
			scopeIds: ['c', 'a'],
			name: 'C +1',
			colours: [c(1)],
			depth: 0,
			// The chevron of a merged row unfolds its members (C5); folded, nothing follows it.
			hasChildren: true,
			expanded: false
		});
		expect(projection.rows).toHaveLength(2);
		// A's direct records and the roll-up of its subtree, as a collapsed group row (Q2-A).
		const byTrace = Object.fromEntries(merged.marks.map((mark) => [mark.traceId, mark.rollup]));
		expect(byTrace).toEqual({ t1: false, t2: false, t4: false, t3: true });
		expect(merged).toMatchObject({ directCount: 3, subtreeCount: 4 });
		expect(merged.range).toEqual({ start: Date.UTC(2026, 2, 1), end: Date.UTC(2026, 4, 1, 12) });
		expect(
			merged.marks.every((mark) => mark.rowId === 'c+a' && mark.id === `${mark.traceId}@c+a`)
		).toBe(true);
		// Only A colours the row: every mark answers to hue 1 alone.
		expect(merged.marks.map((mark) => mark.colours)).toEqual([[c(1)], [c(1)], [c(1)], [c(1)]]);
	});

	it('a record in two merged members appears once, direct, with both hues: the weave fires', () => {
		const projection = projectSnapshot(snapshot, state({ arrangement: lanes(['a', 'b']) }));
		const merged = projection.rows[0];
		expect(merged).toMatchObject({
			id: 'a+b',
			name: 'A +1',
			scopeIds: ['a', 'b'],
			colours: [c(1), c(5)]
		});
		const marks = Object.fromEntries(merged.marks.map((mark) => [mark.traceId, mark]));
		expect(Object.keys(marks).sort()).toEqual(['t1', 't2', 't3', 't4']);
		expect(marks.t2).toMatchObject({ rollup: false, colours: [c(1), c(5)], multi: true });
		// t3 is B's own record and A's roll-up at once: direct wins, and both members colour it.
		expect(marks.t3).toMatchObject({ rollup: false, colours: [c(1), c(5)] });
		expect(marks.t1).toMatchObject({ rollup: false, colours: [c(1)] });
		expect(markColours(merged, marks.t2, palette)).toEqual(['s1', 's5']);
		expect(markColours(merged, marks.t1, palette)).toEqual(['s1']);
		// Σ is the deduplicated union (DP8): four records, all direct in some member.
		expect(merged).toMatchObject({ directCount: 4, subtreeCount: 4 });
		expect(projection.marksByTraceId.get('t2')?.map((mark) => mark.rowId)).toEqual(['a+b']);
	});

	it('a group member rolls its subtree up whatever the disclosure says; the merged row stands folded until its own chevron', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'a']), expanded: new Set(['a']) })
		);
		const merged = projection.rows[0];
		expect(merged).toMatchObject({ hasChildren: true, expanded: false });
		expect(merged.marks.find((mark) => mark.traceId === 't3')).toMatchObject({ rollup: true });
		expect(projection.rows.map((row) => row.id)).toEqual(['c+a']);
	});

	it('an unfolded lane (C5): the merged row as it is, then its members beneath it at depth 1, each its ordinary row', () => {
		const folded = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'a'], [UNSCOPED_ROW_ID]) })
		);
		const open = projectSnapshot(
			snapshot,
			state({
				arrangement: {
					lanes: [{ members: ['c', 'a'], expanded: true }, { members: [UNSCOPED_ROW_ID] }]
				}
			})
		);
		expect(open.rows.map((row) => [row.id, row.depth])).toEqual([
			['c+a', 0],
			['c', 1],
			['a', 1],
			[UNSCOPED_ROW_ID, 0]
		]);
		// The merged row is unchanged by the fold: the union of the members, the same counts, the same range.
		expect(open.rows[0]).toMatchObject({ kind: 'merged', hasChildren: true, expanded: true });
		expect({ ...open.rows[0], expanded: false }).toEqual(folded.rows[0]);
		expect(open.rows[0]).toMatchObject({ directCount: 3, subtreeCount: 4 });
		// A member is the row it would be on its own: A folded rolls B up, with a chevron of its own.
		expect(open.rows[2]).toMatchObject({
			kind: 'scope',
			scopeId: 'a',
			hasChildren: true,
			expanded: false,
			directCount: 3,
			subtreeCount: 4
		});
		expect(open.rows[2].marks.find((mark) => mark.traceId === 't3')).toMatchObject({
			rollup: true
		});
		expect(open.rows[1]).toMatchObject({ kind: 'scope', scopeId: 'c', marks: [] });
		// The member's own disclosure unfolds its children under it, at depth 2.
		const deep = projectSnapshot(
			snapshot,
			state({
				arrangement: { lanes: [{ members: ['c', 'a'], expanded: true }] },
				expanded: new Set(['a'])
			})
		);
		expect(deep.rows.map((row) => [row.id, row.depth])).toEqual([
			['c+a', 0],
			['c', 1],
			['a', 1],
			['b', 2]
		]);
		expect(deep.rows[0].marks.find((mark) => mark.traceId === 't3')).toMatchObject({
			rollup: true
		});
		// «Без Scope» as a member: the unscoped row at depth 1; a plain lane's flag means nothing.
		const unscoped = projectSnapshot(
			snapshot,
			state({
				arrangement: {
					lanes: [
						{ members: ['c', UNSCOPED_ROW_ID], expanded: true },
						{ members: ['a'], expanded: true }
					]
				}
			})
		);
		expect(unscoped.rows.map((row) => [row.id, row.kind, row.depth])).toEqual([
			[`c+${UNSCOPED_ROW_ID}`, 'merged', 0],
			['c', 'scope', 1],
			[UNSCOPED_ROW_ID, 'unscoped', 1],
			['a', 'scope', 0]
		]);
		// Every projection of a record is in `marksByTraceId`: the merged row's and the member row's.
		expect(open.marksByTraceId.get('t1')?.map((mark) => mark.rowId)).toEqual(['c+a', 'a']);
	});

	it('the owner name replaces the auto-name', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: { lanes: [{ members: ['c', 'a'], name: 'Дом' }] } })
		);
		expect(projection.rows[0].name).toBe('Дом');
	});

	it('hidden and «only» members contribute nothing; a lane left with one member is that plain row', () => {
		const one = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['a', 'c'], [UNSCOPED_ROW_ID]), hiddenScopes: new Set(['a']) })
		);
		expect(one.rows.map((row) => row.id)).toEqual(['c', UNSCOPED_ROW_ID]);
		expect(one.rows[0]).toMatchObject({ kind: 'scope', scopeId: 'c', scopeIds: ['c'] });
		// A hidden group hides its subtree: the lane of A and B has nothing left and is not emitted.
		const none = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['a', 'b'], [UNSCOPED_ROW_ID]), hiddenScopes: new Set(['a']) })
		);
		expect(none.rows.map((row) => row.id)).toEqual([UNSCOPED_ROW_ID]);
		// «Только эти Scope» keeps B and its ancestor A; C and «Без Scope» leave the merged row and the ribbon.
		const only = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'a', UNSCOPED_ROW_ID], ['b']), onlyScopes: new Set(['b']) })
		);
		expect(only.rows.map((row) => row.id)).toEqual(['a', 'b']);
	});

	it('a Scope claimed by a lane stands at its lane, not under its expanded parent', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'b'], ['a'], [UNSCOPED_ROW_ID]), expanded: new Set(['a']) })
		);
		expect(projection.rows.map((row) => row.id)).toEqual(['c+b', 'a', UNSCOPED_ROW_ID]);
		expect(projection.rows[0].marks.map((mark) => mark.traceId).sort()).toEqual(['t2', 't3']);
		// The parent has nothing left to unfold (review 2026-09-19, п. 32): no chevron, and it stands
		// folded whatever the disclosure says — the claimed child stays in its roll-up (C1, п. 32).
		expect(projection.rows[1]).toMatchObject({ hasChildren: false, expanded: false, depth: 0 });
		expect(
			projection.rows[1].marks.map((mark) => `${mark.traceId}${mark.rollup ? '↑' : ''}`).sort()
		).toEqual(['t1', 't2', 't3↑', 't4']);
		expect(projection.rows[1]).toMatchObject({ directCount: 3, subtreeCount: 4 });
		// With another child left, the parent keeps its chevron and unfolds to that child alone.
		const twoChildren: ExplorerSnapshot = {
			...snapshot,
			scopes: [...snapshot.scopes, scope('d')],
			intersections: [...snapshot.intersections, link('d', 'a', 'child_of')]
		};
		const partial = projectSnapshot(
			twoChildren,
			state({
				arrangement: lanes(['c', 'b'], ['a'], [UNSCOPED_ROW_ID]),
				expanded: new Set(['a'])
			})
		);
		expect(partial.rows.map((row) => row.id)).toEqual(['c+b', 'a', 'd', UNSCOPED_ROW_ID]);
		expect(partial.rows[1]).toMatchObject({ hasChildren: true, expanded: true });
		expect(partial.rows[1].marks.map((mark) => mark.traceId).sort()).toEqual(['t1', 't2', 't4']);
	});

	it('«Без Scope» can be a member too; the merged row lists only the Scopes', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', UNSCOPED_ROW_ID]) })
		);
		expect(projection.rows[0]).toMatchObject({
			id: `c+${UNSCOPED_ROW_ID}`,
			kind: 'merged',
			name: 'C +1',
			scopeIds: ['c'],
			directCount: 1,
			subtreeCount: 1
		});
		expect(projection.rows[0].marks.map((mark) => mark.traceId)).toEqual(['t6']);
		expect(projection.rows[0].marks[0].colours).toEqual([]);
	});

	it('never throws on stale members and never invents lanes: what the arrangement lacks is not shown', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['gone', 'a'], ['zzz']) })
		);
		expect(projection.rows.map((row) => row.id)).toEqual(['a']);
		expect(projection.rows[0].kind).toBe('scope');
	});

	it('the kind grouping ignores the arrangement', () => {
		const plain = projectSnapshot(snapshot, state({ grouping: 'kind' }));
		expect(
			projectSnapshot(snapshot, state({ grouping: 'kind', arrangement: lanes(['a', 'b']) }))
		).toEqual(plain);
	});

	it('the legend filter applies inside a merged row and its counts follow', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'a']), hiddenLegend: new Set(['intent', 'rollup']) })
		);
		const merged = projection.rows[0];
		expect(merged.marks.map((mark) => mark.traceId).sort()).toEqual(['t1', 't2']);
		// The hidden intention leaves both counts; the roll-up stays counted in Σ, as in a group row.
		expect(merged).toMatchObject({ directCount: 2, subtreeCount: 3 });
	});

	it('the legend lists the kinds of the merged marks — the roll-up of a group member is «rollup» — and a solo keeps only them (п. 17; C3)', () => {
		const present = projectSnapshot(snapshot, state({ arrangement: lanes(['c', 'a']) }));
		// t3 (a month) is fuzzy, t4 (May, open) is overdue at this «сейчас»; t3 through A is the roll-up.
		expect([...present.legendKeys].sort()).toEqual([
			'fact',
			'fuzzy',
			'intent',
			'interval',
			'multi',
			'overdue',
			'rollup'
		]);
		const solo = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'a']), soloLegend: 'rollup' })
		);
		expect(solo.rows[0].marks.map((mark) => mark.traceId)).toEqual(['t3']);
		// With B a member too, t3 is direct: nothing rolls up, and the legend says so.
		const direct = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['a', 'b']), soloLegend: 'rollup' })
		);
		expect(direct.rows[0].marks).toEqual([]);
		expect(direct.legendKeys.has('rollup')).toBe(false);
	});

	it('the Scope search narrows a merged row to the members it matches: two or more stay merged, one shows as its plain row, none leaves (C3)', () => {
		const wide: ExplorerSnapshot = {
			...snapshot,
			scopes: [...snapshot.scopes, { ...scope('ab', 7), name: 'AX' }]
		};
		const arrangement = lanes(['c', 'ab', 'a'], [UNSCOPED_ROW_ID]);
		// «a» matches A and AX (and B under A): the lane keeps those two, named over them; C is out.
		const two = projectSnapshot(wide, state({ arrangement, scopeQuery: 'a' }));
		expect(two.rows.map((row) => row.id)).toEqual(['ab+a']);
		expect(two.rows[0]).toMatchObject({ kind: 'merged', name: 'AX +1', colours: [c(7), c(1)] });
		// «c» matches C alone: the lane shows as the plain row C.
		const one = projectSnapshot(wide, state({ arrangement, scopeQuery: 'c' }));
		expect(one.rows.map((row) => row.id)).toEqual(['c']);
		expect(one.rows[0].kind).toBe('scope');
		// «b» matches B under A: A stands for the lane, unfolded to its match, as a plain row would.
		const path = projectSnapshot(wide, state({ arrangement, scopeQuery: 'b' }));
		expect(path.rows.map((row) => row.id)).toEqual(['a', 'b']);
		expect(path.rows[0]).toMatchObject({ kind: 'scope', expanded: true });
		// Nothing matches: no rows; an empty query brings the merged row back as it was.
		expect(projectSnapshot(wide, state({ arrangement, scopeQuery: 'zzz' })).rows).toEqual([]);
		expect(projectSnapshot(wide, state({ arrangement })).rows.map((row) => row.id)).toEqual([
			'c+ab+a',
			UNSCOPED_ROW_ID
		]);
	});

	it('hovering a merged row lights the records of every member, wherever they project (п. 5)', () => {
		const projection = projectSnapshot(
			snapshot,
			state({ arrangement: lanes(['c', 'a'], ['b']), expanded: new Set() })
		);
		const lit = lensSet({ kind: 'row', rowId: 'c+a' }, projection.rows, projection.links, snapshot);
		expect([...lit.traceIds].sort()).toEqual(['t1', 't2', 't3', 't4']);
		expect([...lit.rowIds]).toEqual(['c+a']);
		// A record of the merged row hovered on the ribbon names every row that holds it.
		const trace = lensSet(
			{ kind: 'trace', traceId: 't3' },
			projection.rows,
			projection.links,
			snapshot
		);
		expect([...trace.rowIds]).toEqual(['c+a', 'b']);
	});
});
