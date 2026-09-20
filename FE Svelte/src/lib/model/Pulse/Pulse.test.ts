import { describe, expect, it } from 'vitest';
import { rows, sorted, view } from '$lib/model/Lens/fixture';
import { EMPTY_PULSE, pulseSet } from './Pulse';

describe('pulseSet: where to look after a Context or history navigation (loop 008, C3)', () => {
	it('nothing at rest, and nothing for a record the rows do not draw', () => {
		expect(pulseSet(null, rows, view)).toBe(EMPTY_PULSE);
		expect(pulseSet({ kind: 'trace', traceId: 'hidden' }, rows, view)).toBe(EMPTY_PULSE);
	});

	it('a record rings every projection it has and flashes the names of the rows holding it', () => {
		const pulse = pulseSet({ kind: 'trace', traceId: 'offer' }, rows, view);
		expect([...pulse.traceIds]).toEqual(['offer']);
		expect([...pulse.rowIds]).toEqual(['belgrade', 'work']);
	});

	it('a Scope flashes the name of the row that stands for it — its own, or the parent it rolls up into — and rings nothing', () => {
		expect(pulseSet({ kind: 'scope', scopeId: 'belgrade' }, rows, view)).toEqual({
			traceIds: new Set(),
			rowIds: new Set(['belgrade'])
		});
		expect([...pulseSet({ kind: 'scope', scopeId: 'project' }, rows, view).rowIds]).toEqual([
			'work'
		]);
		expect(pulseSet({ kind: 'scope', scopeId: 'gone' }, rows, view)).toBe(EMPTY_PULSE);
	});

	it('a merged row (C5) flashes its own name and rings nothing; a row the rail does not show, nothing', () => {
		expect(pulseSet({ kind: 'row', rowId: 'work' }, rows, view)).toEqual({
			traceIds: new Set(),
			rowIds: new Set(['work'])
		});
		expect(pulseSet({ kind: 'row', rowId: 'gone' }, rows, view)).toBe(EMPTY_PULSE);
	});

	it('an explicit link rings both record ends; a Scope end flashes its row; an unknown link nothing', () => {
		const link = pulseSet(
			{ kind: 'intersection', intersectionId: 'l:course-interview' },
			rows,
			view
		);
		expect(sorted(link.traceIds)).toEqual(['course', 'interview']);
		expect([...link.rowIds]).toEqual(['belgrade', 'work']);
		const membership = pulseSet({ kind: 'intersection', intersectionId: 'i:move' }, rows, view);
		expect([...membership.traceIds]).toEqual(['move']);
		expect([...membership.rowIds]).toEqual(['belgrade']);
		expect(pulseSet({ kind: 'intersection', intersectionId: 'gone' }, rows, view)).toBe(
			EMPTY_PULSE
		);
	});
});
