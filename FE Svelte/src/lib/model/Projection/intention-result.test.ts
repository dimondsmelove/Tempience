import { describe, expect, it } from 'vitest';
import type { ExplorerSnapshot, ExplorerTrace } from '$lib/model/Snapshot/types';
import { EMPTY_PROJECTION_STATE, UNSCOPED_ROW_ID } from './constants';
import { projectSnapshot } from './Projection';
import type { ProjectionState } from './types';

const origin = { kind: 'canonical' as const, sourceId: 'test' };
const trace = (id: string, patch: Partial<ExplorerTrace> = {}): ExplorerTrace => ({
	id,
	content: `Запись ${id}`,
	relation: 'actual',
	timezone: 'Europe/Belgrade',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-09-25',
		end: null
	},
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin,
	...patch
});
const link = (fromId: string, toId: string, kind: 'belongs_to' | 'evidence_for') => ({
	id: `${kind}:${fromId}:${toId}`,
	fromId,
	toId,
	kind,
	context: null,
	origin
});
const NOW = Date.UTC(2026, 8, 6, 12);
const state = (patch: Partial<ProjectionState> = {}): ProjectionState => ({
	...EMPTY_PROJECTION_STATE,
	now: NOW,
	...patch
});

/**
 * An intention closed by its result, as the snapshot hands it over (`intentOpen: false`), the
 * result fact at «сейчас» and the evidence link between them — the owner's flow of 2026-09-19 (B1).
 */
const closed = trace('i1', {
	relation: 'intend',
	intentOpen: false,
	intentOutcome: 'completed',
	intentClosedAt: '2026-09-06T12:00:00.000Z'
});
const result = trace('f1', {
	aboutTime: {
		basis: 'absolute',
		precision: 'minute',
		certainty: 'exact',
		start: '2026-09-06T12:00:00.000Z',
		end: null
	},
	closesIntentionIds: ['i1']
});
const snapshot: ExplorerSnapshot = {
	scopes: [],
	traces: [closed, result],
	periods: [],
	intersections: [link('f1', 'i1', 'evidence_for')],
	scopeSegments: []
};
const rowOf = (projection: ReturnType<typeof projectSnapshot>) =>
	projection.rows.find((row) => row.id === UNSCOPED_ROW_ID)!;

describe('projectSnapshot — a closed intention and its result', () => {
	it('keeps both on the ribbon: the ✓ capsule at the intention’s own day, the fact at its own time, the link', () => {
		const projection = projectSnapshot(snapshot, state());
		expect(rowOf(projection).marks.map((mark) => [mark.traceId, mark.kind, mark.closed])).toEqual([
			['i1', 'moment', true],
			['f1', 'moment', undefined]
		]);
		expect(rowOf(projection).marks.map((mark) => mark.label)).toEqual(['✓ Запись i1', 'Запись f1']);
		// The intention stays where it was planned; only the caption says it is closed.
		expect(projection.timeByTraceId.get('i1')).toMatchObject({
			intent: true,
			start: Date.UTC(2026, 8, 25, 12)
		});
		expect(projection.parked).toEqual([]);
		expect(projection.counts).toMatchObject({ onAxis: 2, intents: 1, parked: 0 });
		expect(projection.links).toEqual([
			{ fromTraceId: 'f1', toTraceId: 'i1', kind: 'evidence_for' }
		]);
		expect([...projection.legendKeys].sort()).toEqual(['closed', 'fact', 'intent']);
	});

	it('carries the closing instant on the intention and the result flag on the fact (C4); the forced caption adds the day', () => {
		const projection = projectSnapshot(snapshot, state());
		const [intention, fact] = rowOf(projection).marks;
		expect(intention).toMatchObject({
			closed: true,
			closedAt: Date.UTC(2026, 8, 6, 12),
			label: '✓ Запись i1',
			forcedLabel: '✓ Запись i1 · ✓ 6 сен'
		});
		expect(intention).not.toHaveProperty('result');
		expect(fact).toMatchObject({ result: true });
		expect(fact).not.toHaveProperty('closedAt');
		expect(fact).not.toHaveProperty('forcedLabel');
		// In English the axis month names of that language; a closing in another year names it.
		const english = projectSnapshot(snapshot, state({ language: 'en' }));
		expect(rowOf(english).marks[0].forcedLabel).toBe('✓ Запись i1 · ✓ 6 Sep');
		const lastYear = {
			...snapshot,
			traces: [{ ...closed, intentClosedAt: '2025-12-30T08:00:00.000Z' }, result]
		};
		expect(rowOf(projectSnapshot(lastYear, state())).marks[0].forcedLabel).toBe(
			'✓ Запись i1 · ✓ 30 дек 2025'
		);
		// Without a known instant: closed, no marker, the caption the same forced or not.
		const unknown = { ...snapshot, traces: [{ ...closed, intentClosedAt: null }, result] };
		const bare = rowOf(projectSnapshot(unknown, state())).marks[0];
		expect(bare).toMatchObject({ closed: true, label: '✓ Запись i1' });
		expect(bare).not.toHaveProperty('closedAt');
		expect(bare).not.toHaveProperty('forcedLabel');
	});

	it('an undated result is parked; the closed intention keeps its mark', () => {
		const parkedResult = { ...result, aboutTime: { basis: 'unknown' as const } };
		const projection = projectSnapshot({ ...snapshot, traces: [closed, parkedResult] }, state());
		expect(rowOf(projection).marks.map((mark) => mark.traceId)).toEqual(['i1']);
		expect(projection.parked.map((item) => [item.traceId, item.reason])).toEqual([
			['f1', 'unknown']
		]);
	});

	it('under solo «намерение» the closed one stays — «намерение» is every intention, open or closed (owner 2026-09-19, L1) — and its result follows it (loop 008, C4)', () => {
		const solo = projectSnapshot(snapshot, state({ soloLegend: 'intent' }));
		expect(rowOf(solo).marks.map((mark) => mark.traceId)).toEqual(['i1', 'f1']);
		expect(rowOf(solo)).toMatchObject({ directCount: 2, subtreeCount: 2 });
		expect([...solo.legendKeys].sort()).toEqual(['closed', 'fact', 'intent']);
		// Hiding «намерение» hides the closed one, not its result — that is a fact; solo
		// «закрытое» shows the closed one with its result.
		const hidden = projectSnapshot(snapshot, state({ hiddenLegend: new Set(['intent']) }));
		expect(rowOf(hidden).marks.map((mark) => mark.traceId)).toEqual(['f1']);
		const closedHidden = projectSnapshot(snapshot, state({ hiddenLegend: new Set(['closed']) }));
		expect(rowOf(closedHidden).marks.map((mark) => mark.traceId)).toEqual(['f1']);
		const closedSolo = projectSnapshot(snapshot, state({ soloLegend: 'closed' }));
		expect(rowOf(closedSolo).marks.map((mark) => mark.traceId)).toEqual(['i1', 'f1']);
		expect(rowOf(closedSolo)).toMatchObject({ directCount: 2, subtreeCount: 2 });
		// A fact that closed nothing leaves under either solo, as before.
		const plain = { ...snapshot, traces: [closed, { ...result, closesIntentionIds: undefined }] };
		expect(
			rowOf(projectSnapshot(plain, state({ soloLegend: 'intent' }))).marks.map((m) => m.traceId)
		).toEqual(['i1']);
		expect(rowOf(projectSnapshot(plain, state({ soloLegend: 'intent' })))).toMatchObject({
			directCount: 1,
			subtreeCount: 1
		});
		// Hiding «факт» takes the result with the other facts.
		const factHidden = projectSnapshot(snapshot, state({ hiddenLegend: new Set(['fact']) }));
		expect(rowOf(factHidden).marks.map((mark) => mark.traceId)).toEqual(['i1']);
	});
});
