import { describe, expect, it } from 'vitest';
import type {
	ExplorerIntersection,
	ExplorerScope,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';
import { EMPTY_PROJECTION_STATE } from '$lib/model/Projection/constants';
import { projectSnapshot } from '$lib/model/Projection/Projection';
import type { TraceAboutTime } from '$lib/state/triplit/types';
import { filterCounts, hiddenScopeCounts, kindCounts, scopeCountsLabel } from './FilterCounts';
import type { FilterCountsState } from './FilterCounts';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const scope = (id: string): ExplorerScope => ({
	id,
	name: id.toUpperCase(),
	note: null,
	startedAt: null,
	endedAt: null,
	colorHue: null,
	colorChroma: null,
	origin
});
const day = (start: string): TraceAboutTime => ({
	basis: 'absolute',
	precision: 'day',
	certainty: 'exact',
	start,
	end: null
});
const trace = (
	id: string,
	aboutTime: TraceAboutTime | null,
	options: Readonly<{ kindId?: string; intend?: boolean }> = {}
): ExplorerTrace => ({
	id,
	content: `Запись ${id}`,
	relation: options.intend ? 'intend' : 'actual',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime,
	aboutTraceId: null,
	kindId: options.kindId ?? null,
	kindVId: options.kindId ? `${options.kindId}-v1` : null,
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
 * Work (a) holds Front (b) which holds Tests (c); Home (d) stands alone.
 *   a: t1 (fact), t4 (intention), p1 (parked, no time)
 *   b: t2, t3 (also in a: counted once in a's subtree)
 *   c: t5, k1 (Kind «letter», off the ribbon until the Kind is ticked)
 *   d: k2 (Kind «letter»), k3 (Kind «call»)
 */
const snapshot: ExplorerSnapshot = {
	scopes: [scope('a'), scope('b'), scope('c'), scope('d')],
	traces: [
		trace('t1', day('2026-03-10')),
		trace('t2', day('2026-03-11')),
		trace('t3', day('2026-03-12')),
		trace('t4', day('2026-05-01'), { intend: true }),
		trace('t5', day('2026-03-13')),
		trace('p1', null),
		trace('k1', day('2026-03-14'), { kindId: 'letter' }),
		trace('k2', day('2026-03-15'), { kindId: 'letter' }),
		trace('k3', null, { kindId: 'call' })
	],
	periods: [],
	intersections: [
		link('b', 'a', 'child_of'),
		link('c', 'b', 'child_of'),
		link('t1', 'a', 'belongs_to'),
		link('t4', 'a', 'belongs_to'),
		link('p1', 'a', 'belongs_to'),
		link('t2', 'b', 'belongs_to'),
		link('t3', 'b', 'belongs_to'),
		link('t3', 'a', 'belongs_to'),
		link('t5', 'c', 'belongs_to'),
		link('k1', 'c', 'belongs_to'),
		link('k2', 'd', 'belongs_to'),
		link('k3', 'd', 'belongs_to')
	],
	scopeSegments: []
};
const state = (patch: Partial<FilterCountsState> = {}): FilterCountsState => ({
	...EMPTY_PROJECTION_STATE,
	now: Date.UTC(2026, 8, 6, 12),
	...patch
});
/** The rail's numbers for a Scope row as the ribbon projects them, every group unfolded. */
const railCounts = (scopeId: string, patch: Partial<FilterCountsState> = {}) => {
	const row = projectSnapshot(snapshot, {
		...state(patch),
		expanded: new Set(['a', 'b', 'c', 'd'])
	}).rows.find((item) => item.id === scopeId)!;
	return { direct: row.directCount, subtree: row.subtreeCount };
};

describe('kindCounts: the number beside a Kind checkbox (C7)', () => {
	it('counts the records of each Kind once, timed or parked, whatever the filters', () => {
		const counts = kindCounts(snapshot.traces);
		expect(counts.get('letter')).toBe(2);
		expect(counts.get('call')).toBe(1);
		// A Kind with no record is not listed: the popover reads it as «· 0».
		expect(counts.get('weight')).toBeUndefined();
		// The same record twice in a view (a proposal over its own original) is one record.
		expect(kindCounts([...snapshot.traces, snapshot.traces[6]]).get('letter')).toBe(2);
	});
});

describe('hiddenScopeCounts: the chip of a hidden Scope says what its rail row would (C7)', () => {
	it('is empty with nothing hidden, and equal to the rail row for a hidden group — parked records not counted', () => {
		expect(hiddenScopeCounts(snapshot, state()).size).toBe(0);
		const counts = hiddenScopeCounts(snapshot, state({ hiddenScopes: new Set(['a']) }));
		expect(counts.get('a')).toEqual(railCounts('a'));
		// a: t1, t4, t3 direct on the ribbon (p1 parked); the subtree adds t2, t5 — t3 once.
		expect(counts.get('a')).toEqual({ direct: 3, subtree: 5 });
	});

	it('follows the legend and the Kinds as they stand, and reaches a child under a folded parent', () => {
		const hidden = new Set(['c']);
		expect(hiddenScopeCounts(snapshot, state({ hiddenScopes: hidden })).get('c')).toEqual({
			direct: 1,
			subtree: 1
		});
		const letters = { shownKindIds: new Set(['letter']) };
		const shown = state({ hiddenScopes: hidden, ...letters });
		expect(hiddenScopeCounts(snapshot, shown).get('c')).toEqual(railCounts('c', letters));
		expect(hiddenScopeCounts(snapshot, shown).get('c')).toEqual({ direct: 2, subtree: 2 });
		const intents = { soloLegend: 'intent' as const };
		const solo = state({ hiddenScopes: new Set(['a']), ...intents });
		expect(hiddenScopeCounts(snapshot, solo).get('a')).toEqual(railCounts('a', intents));
		expect(hiddenScopeCounts(snapshot, solo).get('a')).toEqual({ direct: 1, subtree: 1 });
	});

	it('a hidden child stays out of its hidden parent’s subtree, and keeps its own numbers under the hidden parent', () => {
		const counts = hiddenScopeCounts(snapshot, state({ hiddenScopes: new Set(['a', 'b']) }));
		expect(counts.get('b')).toEqual(railCounts('b'));
		expect(counts.get('b')).toEqual({ direct: 2, subtree: 3 });
		expect(counts.get('a')).toEqual(railCounts('a', { hiddenScopes: new Set(['b']) }));
		expect(counts.get('a')).toEqual({ direct: 3, subtree: 3 });
	});

	it('leaves the Scope search and the row arrangement aside; a Scope outside «Только эти Scope» or unknown counts nothing', () => {
		const searched = state({ hiddenScopes: new Set(['a']), scopeQuery: 'zzz', grouping: 'kind' });
		expect(hiddenScopeCounts(snapshot, searched).get('a')).toEqual({ direct: 3, subtree: 5 });
		const only = state({ hiddenScopes: new Set(['a']), onlyScopes: new Set(['d']) });
		expect(hiddenScopeCounts(snapshot, only).get('a')).toEqual({ direct: 0, subtree: 0 });
		expect(
			hiddenScopeCounts(snapshot, state({ hiddenScopes: new Set(['gone']) })).get('gone')
		).toEqual({ direct: 0, subtree: 0 });
	});
});

describe('filterCounts and the chip label', () => {
	it('gathers both maps; the label writes the numbers as the rail does', () => {
		const counts = filterCounts(snapshot, state({ hiddenScopes: new Set(['d']) }));
		expect(counts.kinds.get('call')).toBe(1);
		expect(counts.hiddenScopes.get('d')).toEqual({ direct: 0, subtree: 0 });
		expect(scopeCountsLabel({ direct: 6, subtree: 180 })).toBe('6 · Σ 180');
		expect(scopeCountsLabel({ direct: 0, subtree: 0 })).toBe('0 · Σ 0');
	});
});
