import { describe, expect, it } from 'vitest';
import { SelectionState } from './Selection.svelte';

const day = (n: number): number => Date.UTC(2026, 0, 1 + n);

describe('SelectionState', () => {
	it('keeps persisted links and periods distinct from endpoint selections and calendar ranges', () => {
		const selection = new SelectionState();
		selection.select({ kind: 'trace', traceId: 'a' }, 'canvas');
		selection.select({ kind: 'intersection', intersectionId: 'a' }, 'context');
		selection.select({ kind: 'period-record', periodId: 'a' }, 'context');
		expect(selection.entries).toHaveLength(3);
		expect(selection.entityId).toBe('a');
		expect(selection.period).toBeNull();
		selection.back();
		expect(selection.current?.kind).toBe('intersection');
		expect(selection.traceId).toBeNull();
		selection.rest();
		expect(selection.entityId).toBeNull();
		selection.forward();
		expect(selection.current?.kind).toBe('intersection');
		selection.back();
		expect(selection.traceId).toBe('a');
	});

	it('keeps Scope and Trace distinct in history even when their ids match', () => {
		const selection = new SelectionState();
		selection.select({ kind: 'scope', scopeId: 'a' }, 'rail');
		selection.select({ kind: 'trace', traceId: 'a' }, 'context');
		expect(selection.entries).toHaveLength(2);
		selection.back();
		expect(selection.scopeId).toBe('a');
		expect(selection.traceId).toBeNull();
		selection.rest();
		expect(selection.scopeId).toBeNull();
		selection.forward();
		expect(selection.scopeId).toBe('a');
		selection.forward();
		expect(selection.traceId).toBe('a');
	});

	it('records selections, walks the history and drops the forward branch', () => {
		const selection = new SelectionState();
		expect(selection.current).toBeNull();
		selection.select({ kind: 'trace', traceId: 'a' }, 'canvas');
		selection.select({ kind: 'trace', traceId: 'b' }, 'twin');
		selection.select(
			{ kind: 'period', period: { unit: 'day', start: day(0), end: day(1) } },
			'axis'
		);
		expect(selection.position).toEqual({ n: 3, m: 3 });
		expect(selection.traceId).toBeNull();
		expect(selection.period?.unit).toBe('day');
		selection.back();
		expect(selection.traceId).toBe('b');
		expect(selection.source).toBe('history');
		selection.back();
		expect(selection.traceId).toBe('a');
		expect(selection.canBack).toBe(false);
		selection.forward();
		expect(selection.traceId).toBe('b');
		selection.select({ kind: 'trace', traceId: 'c' }, 'rail');
		expect(
			selection.entries.map((entry) => (entry.kind === 'trace' ? entry.traceId : 'p'))
		).toEqual(['a', 'b', 'c']);
		expect(selection.canForward).toBe(false);
	});

	it('re-selecting the current target keeps history but bumps the revision and source', () => {
		const selection = new SelectionState();
		selection.select({ kind: 'trace', traceId: 'a' }, 'canvas');
		const revision = selection.revision;
		selection.select({ kind: 'trace', traceId: 'a' }, 'twin');
		expect(selection.position).toEqual({ n: 1, m: 1 });
		expect(selection.revision).toBe(revision + 1);
		expect(selection.source).toBe('twin');
		selection.clear();
		expect(selection.current).toBeNull();
	});

	it('rest hides the selection but keeps the history, and «→» brings it back', () => {
		const selection = new SelectionState();
		selection.select({ kind: 'trace', traceId: 'a' }, 'canvas');
		selection.select({ kind: 'trace', traceId: 'b' }, 'canvas');
		const revision = selection.revision;
		selection.rest();
		expect(selection.resting).toBe(true);
		expect(selection.current).toBeNull();
		expect(selection.traceId).toBeNull();
		expect(selection.period).toBeNull();
		expect(selection.entries).toHaveLength(2);
		expect(selection.index).toBe(1);
		expect(selection.position).toEqual({ n: null, m: 2 });
		expect(selection.canBack).toBe(false);
		expect(selection.canForward).toBe(true);
		expect(selection.revision).toBe(revision + 1);
		selection.back();
		expect(selection.current).toBeNull();
		expect(selection.index).toBe(1);
		selection.forward();
		expect(selection.resting).toBe(false);
		expect(selection.traceId).toBe('b');
		expect(selection.source).toBe('history');
		expect(selection.position).toEqual({ n: 2, m: 2 });
		expect(selection.canForward).toBe(false);
	});

	it('rest is a no-op without a selection and selecting from rest continues the history', () => {
		const selection = new SelectionState();
		const revision = selection.revision;
		selection.rest();
		expect(selection.resting).toBe(false);
		expect(selection.canForward).toBe(false);
		expect(selection.revision).toBe(revision);
		selection.select({ kind: 'trace', traceId: 'a' }, 'canvas');
		selection.select({ kind: 'trace', traceId: 'b' }, 'canvas');
		selection.back();
		selection.rest();
		selection.select({ kind: 'trace', traceId: 'c' }, 'context');
		expect(selection.resting).toBe(false);
		expect(
			selection.entries.map((entry) => (entry.kind === 'trace' ? entry.traceId : 'p'))
		).toEqual(['a', 'c']);
		expect(selection.position).toEqual({ n: 2, m: 2 });
		selection.rest();
		selection.clear();
		expect(selection.resting).toBe(false);
		expect(selection.position).toEqual({ n: 0, m: 0 });
	});
});
