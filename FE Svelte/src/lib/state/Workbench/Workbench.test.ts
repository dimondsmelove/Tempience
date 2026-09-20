import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PULSE_MS } from '$lib/model/Pulse/constants';
import { ViewportState } from '$lib/state/Viewport/Viewport.svelte';
import { EMPTY_SNAPSHOT } from './constants';
import { WorkbenchState } from './Workbench.svelte';

const window = {
	start: Date.parse('2026-09-01T00:00:00Z'),
	end: Date.parse('2026-09-30T00:00:00Z')
};

describe('WorkbenchState.closeContext (owner review 2026-09-19, pack 4, D)', () => {
	it('rests the selection with the panel and closes what the Context showed; the history keeps the way back', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.selectTrace('t1', 'twin');
		workbench.slot = { range: { start: 1, end: 2 }, traceIds: ['t1', 't2'] };
		workbench.capture = true;
		expect(workbench.selection.traceId).toBe('t1');

		workbench.closeContext();
		expect(workbench.selection.current).toBeNull();
		expect(workbench.selection.traceId).toBeNull();
		expect(workbench.slot).toBeNull();
		expect(workbench.capture).toBe(false);
		// The record is still in the history: «→» returns to it, «←» has nowhere to go.
		expect(workbench.selection.entries).toHaveLength(1);
		expect(workbench.selection.canForward).toBe(true);
		expect(workbench.selection.canBack).toBe(false);
		workbench.forward();
		expect(workbench.selection.traceId).toBe('t1');
	});

	it('clears a Scope and a period selection the same way', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.selectScope('s1', 'rail');
		expect(workbench.selection.scopeId).toBe('s1');
		workbench.closeContext();
		expect(workbench.selection.scopeId).toBeNull();
		workbench.selectPeriod({ unit: 'month', start: window.start, end: window.end });
		expect(workbench.selection.period).not.toBeNull();
		workbench.closeContext();
		expect(workbench.selection.period).toBeNull();
		expect(workbench.selection.entries).toHaveLength(2);
	});

	it('rests a merged row selection (C5) the same way, and reports it in focus while it is shown', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.selectRow('a+b', ['a', 'b']);
		expect(workbench.selection.rowId).toBe('a+b');
		expect(workbench.focusKind).toBe('row');
		expect(workbench.focusTarget).toEqual({ kind: 'row', rowId: 'a+b' });
		workbench.closeContext();
		expect(workbench.selection.rowId).toBeNull();
		expect(workbench.focusKind).toBe('');
		workbench.forward();
		expect(workbench.selection.rowId).toBe('a+b');
	});

	it('is a no-op for the selection when nothing is selected', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		const revision = workbench.selection.revision;
		workbench.closeContext();
		expect(workbench.selection.current).toBeNull();
		expect(workbench.selection.revision).toBe(revision);
	});
});

describe('the pulse — «куда смотреть» (loop 008, C3)', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('runs once for a record, a Scope or a link chosen in the Context or through the history, and ends by itself', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		expect(workbench.pulse).toBeNull();
		workbench.selectTrace('t1', 'context');
		expect(workbench.pulse).toMatchObject({
			key: 'trace:t1',
			target: { kind: 'trace', traceId: 't1' }
		});
		vi.advanceTimersByTime(PULSE_MS - 1);
		expect(workbench.pulse?.key).toBe('trace:t1');
		vi.advanceTimersByTime(1);
		expect(workbench.pulse).toBeNull();
		workbench.selectScope('s1', 'context');
		expect(workbench.pulse?.key).toBe('scope:s1');
		workbench.selectIntersection('i1');
		expect(workbench.pulse?.key).toBe('intersection:i1');
		// A second choice inside the first's run restarts the clock for the new target.
		vi.advanceTimersByTime(PULSE_MS / 2);
		workbench.back();
		expect(workbench.pulse?.key).toBe('scope:s1');
		vi.advanceTimersByTime(PULSE_MS - 1);
		expect(workbench.pulse?.key).toBe('scope:s1');
		vi.advanceTimersByTime(1);
		expect(workbench.pulse).toBeNull();
		workbench.forward();
		expect(workbench.pulse?.key).toBe('intersection:i1');
		// A merged row chosen in the rail pulses nothing; reached through the history, it does (C5).
		workbench.selectRow('a+b', ['a', 'b']);
		expect(workbench.pulse).toBeNull();
		workbench.back();
		workbench.forward();
		expect(workbench.pulse).toMatchObject({
			key: 'row:a+b',
			target: { kind: 'row', rowId: 'a+b' }
		});
	});

	it('does not run for a period, nor for a choice on the ribbon, in the rail or on the axis; a new choice ends the one running', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.selectPeriod({ unit: 'month', start: window.start, end: window.end }, 'context');
		expect(workbench.pulse).toBeNull();
		workbench.selectTrace('t1', 'canvas');
		workbench.selectTrace('t2', 'twin');
		workbench.selectTrace('t3', 'parked');
		workbench.selectScope('s1', 'rail');
		expect(workbench.pulse).toBeNull();
		workbench.back();
		expect(workbench.pulse?.key).toBe('trace:t3');
		// A choice on the ribbon while a pulse runs ends it: the eye is already there.
		workbench.selectTrace('t3', 'canvas');
		expect(workbench.pulse).toBeNull();
		workbench.back();
		workbench.back();
		expect(workbench.pulse?.key).toBe('trace:t1');
		// Going back to a period through the history pulses nothing, and ends what was running.
		workbench.back();
		expect(workbench.selection.period).not.toBeNull();
		expect(workbench.pulse).toBeNull();
		workbench.forward();
		expect(workbench.pulse?.key).toBe('trace:t1');
		// Closing the Context, or resting, ends it too.
		workbench.closeContext();
		expect(workbench.pulse).toBeNull();
		workbench.forward();
		expect(workbench.pulse?.key).toBe('trace:t1');
		workbench.rest();
		expect(workbench.pulse).toBeNull();
	});
});

describe('the hover and the Context (loop 008, C3, D)', () => {
	it('clears with the Context, and with a choice made in the Context or through its history', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.hover.trace('t1');
		workbench.closeContext();
		expect(workbench.hover.target).toBeNull();
		workbench.selectTrace('t1', 'canvas');
		workbench.hover.set({ kind: 'scope', scopeId: 's1' });
		workbench.selectTrace('t2', 'context');
		expect(workbench.hover.target).toBeNull();
		workbench.hover.set({ kind: 'traces', traceIds: ['t1', 't2'] });
		workbench.back();
		expect(workbench.hover.target).toBeNull();
		workbench.hover.row('r1');
		workbench.selectScope('s1', 'context');
		expect(workbench.hover.target).toBeNull();
		workbench.hover.row('r1');
		workbench.selectPeriod({ unit: 'month', start: window.start, end: window.end }, 'context');
		expect(workbench.hover.target).toBeNull();
	});

	it('leaves the hover to the pointer for a choice on the ribbon, in the rail or on the axis', () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		workbench.hover.trace('t1');
		workbench.selectTrace('t1', 'canvas');
		expect(workbench.hover.target).toEqual({ kind: 'trace', traceId: 't1' });
		workbench.selectTrace('t1', 'twin');
		expect(workbench.hover.target).not.toBeNull();
		workbench.hover.row('r1');
		workbench.selectScope('s1', 'rail');
		expect(workbench.hover.target).toEqual({ kind: 'row', rowId: 'r1' });
		workbench.selectPeriod({ unit: 'month', start: window.start, end: window.end }, 'axis');
		expect(workbench.hover.target).toEqual({ kind: 'row', rowId: 'r1' });
	});
});

describe('WorkbenchState.refresh — the read after a change from another device (2026-09-20)', () => {
	const scopes = (name: string) => ({
		...EMPTY_SNAPSHOT,
		scopes: [
			{
				id: 's1',
				name,
				note: null,
				startedAt: null,
				endedAt: null,
				colorHue: null,
				colorChroma: null,
				colorDepth: null,
				origin: { kind: 'canonical' as const, sourceId: 'canonical' }
			}
		]
	});

	it('replaces the snapshot in place: the status stays ready, the selection and the window stay', async () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		await workbench.load(async () => scopes('Было'));
		workbench.selectScope('s1', 'rail');
		const before = { ...workbench.viewport.window };
		const loaded = workbench.loaded;
		let statusDuring: string | undefined;
		const read = workbench.refresh(async () => {
			statusDuring = workbench.status;
			return scopes('Стало');
		});
		expect(workbench.status).toBe('ready');
		await read;
		expect(statusDuring).toBe('ready');
		expect(workbench.snapshot.scopes[0].name).toBe('Стало');
		expect(workbench.loaded).toBe(loaded + 1);
		expect(workbench.selection.scopeId).toBe('s1');
		expect(workbench.viewport.window).toEqual(before);
		expect(workbench.stale).toBe(false);
	});

	it('leaves the ribbon as it was when the read fails, and is the load itself before the first one', async () => {
		const workbench = new WorkbenchState(new ViewportState(window));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		await workbench.refresh(async () => scopes('Первое'));
		expect(workbench.status).toBe('ready');
		expect(workbench.snapshot.scopes[0].name).toBe('Первое');
		await workbench.refresh(async () => {
			throw new Error('unreadable');
		});
		expect(workbench.status).toBe('ready');
		expect(workbench.snapshot.scopes[0].name).toBe('Первое');
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});
});
