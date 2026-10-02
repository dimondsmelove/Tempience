import { describe, expect, it } from 'vitest';
import { chapterArrangement, lineupNesting } from '$lib/model/Chapters/rows';
import { lineup } from '$lib/model/Chapters/Chapters.fixture';
import type {
	ExplorerIntersection,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import { EMPTY_PROJECTION_STATE } from './constants';
import { projectSnapshot } from './Projection';
import { drawnRecords } from './rollup';
import type { Projection, ProjectionState } from './types';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const scope = (id: string): ExplorerScope => ({
	id,
	name: id,
	note: null,
	startedAt: null,
	endedAt: null,
	colorHue: null,
	colorChroma: null,
	origin
});
const trace = (id: string, day: number): ExplorerTrace => ({
	id,
	content: id,
	relation: 'actual',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: `2026-03-${String(day).padStart(2, '0')}`,
		end: null
	},
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

/**
 * Watson's notebook in small: cases ⊃ study, people ⊃ sherlock, places ⊃ baker, practice.
 * Each Scope holds one record of its own (places none); `both` is in study and in baker — two
 * unrelated Scopes, so it weaves.
 */
const snapshot: ExplorerSnapshot = {
	scopes: ['cases', 'study', 'people', 'sherlock', 'places', 'baker', 'practice'].map(scope),
	traces: [
		trace('case', 1),
		trace('study-1', 2),
		trace('person', 3),
		trace('sherlock-1', 4),
		trace('baker-1', 5),
		trace('baker-2', 6),
		trace('practice-1', 7),
		trace('both', 8)
	],
	periods: [],
	intersections: [
		link('study', 'cases', 'child_of'),
		link('sherlock', 'people', 'child_of'),
		link('baker', 'places', 'child_of'),
		link('case', 'cases', 'belongs_to'),
		link('study-1', 'study', 'belongs_to'),
		link('person', 'people', 'belongs_to'),
		link('sherlock-1', 'sherlock', 'belongs_to'),
		link('baker-1', 'baker', 'belongs_to'),
		link('baker-2', 'baker', 'belongs_to'),
		link('practice-1', 'practice', 'belongs_to'),
		link('both', 'study', 'belongs_to'),
		link('both', 'baker', 'belongs_to')
	],
	scopeSegments: []
};
const state = (patch: Partial<ProjectionState> = {}): ProjectionState => ({
	...EMPTY_PROJECTION_STATE,
	now: Date.UTC(2026, 8, 6, 12),
	...patch
});
/** The chapter of the notebook: study and sherlock in focus, baker in support, the rest in the shadow. */
const chapter = lineup(['study', 'sherlock'], ['baker']);
const chapterState = (
	restOpen = false,
	patch: Partial<ProjectionState> = {},
	view: ExplorerSnapshot = snapshot
): ProjectionState =>
	state({
		arrangement: chapterArrangement(chapter, view, null, restOpen),
		laneChildren: lineupNesting(chapter, view).under,
		...patch
	});
/** Each row by id: its records (a roll-up with «↑») and its `n · Σ m`. */
const drawn = (projection: Projection) =>
	Object.fromEntries(
		projection.rows.map((row) => [
			row.id,
			{
				marks: row.marks.map((mark) => `${mark.traceId}${mark.rollup ? '↑' : ''}`).sort(),
				counts: `${row.directCount} · Σ ${row.subtreeCount}`
			}
		])
	);
/** How many times each record is drawn across the rows. */
const copies = (projection: Projection) =>
	Object.fromEntries([...projection.marksByTraceId].map(([id, marks]) => [id, marks.length]));

describe('a row rolls up only what stands in no row of its own (owner 2026-10-02)', () => {
	it('a folded group rolls its subtree up; expanded, it keeps its direct records and Σ follows', () => {
		const folded = drawn(projectSnapshot(snapshot, state()));
		expect(folded.people).toEqual({ marks: ['person', 'sherlock-1↑'], counts: '1 · Σ 2' });
		const open = projectSnapshot(snapshot, state({ expanded: new Set(['people']) }));
		expect(drawn(open).people).toEqual({ marks: ['person'], counts: '1 · Σ 1' });
		expect(drawn(open).sherlock).toEqual({ marks: ['sherlock-1'], counts: '1 · Σ 1' });
		expect(copies(open)['sherlock-1']).toBe(1);
	});

	it('the chapter lineup: a child lined up into its own row leaves its parent and the shadow', () => {
		const projection = projectSnapshot(snapshot, chapterState());
		expect(projection.rows.map((row) => row.id)).toEqual([
			'study',
			'sherlock',
			'baker',
			'cases+people+places+practice'
		]);
		// The folded shadow draws only what no lineup row shows: the parents' own records.
		expect(drawn(projection)['cases+people+places+practice']).toEqual({
			marks: ['case', 'person', 'practice-1'],
			counts: '3 · Σ 3'
		});
		// Every record once, but `both`: it is in two unrelated Scopes and weaves in both rows.
		expect(copies(projection)).toEqual({
			case: 1,
			'study-1': 1,
			person: 1,
			'sherlock-1': 1,
			'baker-1': 1,
			'baker-2': 1,
			'practice-1': 1,
			both: 2
		});
		expect(projection.marksByTraceId.get('both')?.map((mark) => mark.rowId)).toEqual([
			'study',
			'baker'
		]);
	});

	it('the shadow unfolded: its members draw their own records, the shadow row nothing twice', () => {
		const projection = projectSnapshot(snapshot, chapterState(true));
		// places has nothing left — baker stands in its own row — and nothing to unfold: no row.
		expect(projection.rows.map((row) => [row.id, row.depth])).toEqual([
			['study', 0],
			['sherlock', 0],
			['baker', 0],
			['cases+people+places+practice', 0],
			['cases', 1],
			['people', 1],
			['practice', 1]
		]);
		const rows = drawn(projection);
		// No marks of its own, but the rail reads the lane whole, as folded (owner 2026-10-02).
		expect(rows['cases+people+places+practice']).toEqual({ marks: [], counts: '3 · Σ 3' });
		expect(rows.cases).toEqual({ marks: ['case'], counts: '1 · Σ 1' });
		expect(rows.people).toEqual({ marks: ['person'], counts: '1 · Σ 1' });
		expect(Object.values(copies(projection)).filter((count) => count > 1)).toEqual([2]);
	});

	it('«Только эти Scope» on a lined-up child: its parent left with nothing gets no row', () => {
		const projection = projectSnapshot(
			snapshot,
			chapterState(false, { onlyScopes: new Set(['baker']) })
		);
		expect(projection.rows.map((row) => row.id)).toEqual(['baker']);
		expect(drawn(projection).baker).toEqual({
			marks: ['baker-1', 'baker-2', 'both'],
			counts: '3 · Σ 3'
		});
		// Without the chapter the parent folds the child in, and keeps its row as the roll-up.
		const plain = projectSnapshot(snapshot, state({ onlyScopes: new Set(['baker']) }));
		expect(plain.rows.map((row) => row.id)).toEqual(['places']);
		expect(drawn(plain).places.counts).toBe('0 · Σ 3');
	});

	it('a Scope with no records at all keeps its row (ANSWERS Q9); a parent with a chevron keeps it too', () => {
		const empty: ExplorerSnapshot = {
			...snapshot,
			scopes: [...snapshot.scopes, scope('empty'), scope('nook')],
			intersections: [...snapshot.intersections, link('nook', 'places', 'child_of')]
		};
		const projection = projectSnapshot(empty, chapterState(true, {}, empty));
		expect(projection.rows.map((row) => row.id)).toContain('empty');
		// places now has an unclaimed child to unfold: it stands, though it draws nothing itself.
		expect(drawn(projection).places).toEqual({ marks: [], counts: '0 · Σ 0' });
	});

	it('a child claimed into a device lane leaves its folded parent, which keeps no chevron', () => {
		const lanes = { lanes: [{ members: ['people'] }, { members: ['sherlock'] }] };
		const claimed = projectSnapshot(snapshot, state({ arrangement: lanes }));
		expect(drawn(claimed).people).toEqual({ marks: ['person'], counts: '1 · Σ 1' });
		expect(claimed.rows.find((row) => row.id === 'people')?.hasChildren).toBe(false);
	});
});

describe('drawnRecords', () => {
	const directByScope = new Map([
		['a', new Set(['t1'])],
		['b', new Set(['t2', 't1'])],
		['c', new Set(['t3'])]
	]);
	const children = (id: string) => ({ a: ['b'], b: ['c'] })[id] ?? [];
	it('stops the walk at a descendant standing in another row, and keeps a record direct once', () => {
		const alone = drawnRecords('a', 'a', new Map([['a', 'a']]), children, directByScope);
		expect([...alone.direct]).toEqual(['t1']);
		expect([...alone.rolled].sort()).toEqual(['t2', 't3']);
		const split = drawnRecords(
			'a',
			'a',
			new Map([
				['a', 'a'],
				['c', 'c']
			]),
			children,
			directByScope
		);
		expect([...split.rolled]).toEqual(['t2']);
	});
	it('gives nothing for a Scope whose row is another one', () => {
		const drawn = drawnRecords('a', 'lane', new Map([['a', 'a']]), children, directByScope);
		expect(drawn.direct.size + drawn.rolled.size).toBe(0);
	});
});
