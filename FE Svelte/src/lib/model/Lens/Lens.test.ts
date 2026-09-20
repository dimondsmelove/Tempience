import { describe, expect, it } from 'vitest';
import { EMPTY_LENS, lensSet, linkedTo, underVeil } from './Lens';
import { DAY, links, rows, sorted, view } from './fixture';

describe('lensSet: what the lens lights for every kind of target (loop 008, B)', () => {
	it('lights nothing for no hover, for a gone row and for a record the ribbon does not draw, as one shared value', () => {
		expect(lensSet(null, rows, links, view)).toBe(EMPTY_LENS);
		expect(lensSet({ kind: 'row', rowId: 'gone' }, rows, links, view)).toBe(EMPTY_LENS);
		expect(lensSet({ kind: 'trace', traceId: 'hidden' }, rows, links, view)).toBe(EMPTY_LENS);
	});

	it('a record lights itself in every projection and the records linked to it, both directions; every row holding one is named', () => {
		const lens = lensSet({ kind: 'trace', traceId: 'course' }, rows, links, view);
		expect(sorted(lens.traceIds)).toEqual(['course', 'interview', 'move']);
		expect([...lens.rowIds]).toEqual(['belgrade', 'work']);
		expect(lens.range).toBeNull();
		// The link read from its other end: «move» lights «course» too, and nothing of «interview».
		const move = lensSet({ kind: 'trace', traceId: 'move' }, rows, links, view);
		expect(sorted(move.traceIds)).toEqual(['course', 'move']);
		expect([...move.rowIds]).toEqual(['belgrade']);
		// A record in two Scopes names both rows; a roll-up names the group row it shows through.
		expect([...lensSet({ kind: 'trace', traceId: 'offer' }, rows, links, view).rowIds]).toEqual([
			'belgrade',
			'work'
		]);
		expect([...lensSet({ kind: 'trace', traceId: 'sprint' }, rows, links, view).rowIds]).toEqual([
			'work'
		]);
	});

	it('linkedTo skips a link to itself and a link whose other end is off the ribbon', () => {
		const drawn = new Set(['a', 'b']);
		const loop = [
			{ fromTraceId: 'a', toTraceId: 'a', kind: 'part_of' as const },
			{ fromTraceId: 'a', toTraceId: 'gone', kind: 'part_of' as const },
			{ fromTraceId: 'b', toTraceId: 'a', kind: 'part_of' as const }
		];
		expect([...linkedTo('a', loop, drawn)]).toEqual(['b']);
	});

	it('a row lights every record it draws, roll-ups included, and names only itself — not the rows that hold a projection of a lit record', () => {
		const lens = lensSet({ kind: 'row', rowId: 'work' }, rows, links, view);
		expect(sorted(lens.traceIds)).toEqual(['interview', 'offer', 'sprint', 'trial']);
		// «offer» and «trial» project into Белград, whose name stays under the veil.
		expect([...lens.rowIds]).toEqual(['work']);
		expect(lens.range).toBeNull();
	});

	it('a Scope lights its records with the subtree as its row draws them, drawn ones only, and names the row that stands for it', () => {
		const work = lensSet({ kind: 'scope', scopeId: 'work' }, rows, links, view);
		expect(sorted(work.traceIds)).toEqual(['interview', 'offer', 'sprint', 'trial']);
		expect([...work.rowIds]).toEqual(['work']);
		// «hidden» belongs to Белград but is off the ribbon: it lights nowhere.
		const belgrade = lensSet({ kind: 'scope', scopeId: 'belgrade' }, rows, links, view);
		expect(sorted(belgrade.traceIds)).toEqual(['course', 'move', 'offer', 'trial']);
		// A Scope shown through its collapsed parent: its records, and the parent's row named.
		const project = lensSet({ kind: 'scope', scopeId: 'project' }, rows, links, view);
		expect(sorted(project.traceIds)).toEqual(['interview', 'sprint', 'trial']);
		expect([...project.rowIds]).toEqual(['work']);
		expect(lensSet({ kind: 'scope', scopeId: 'nowhere' }, rows, links, view).traceIds.size).toBe(0);
	});

	it('a period lights the records touching it — an interval across the boundary too, the exclusive end respected — and carries its range', () => {
		// Days 30–40: «interview» (30), «offer» (35), «course» (20–40) and «sprint» (38–50) cross in; «move» (10) does not.
		const period = { unit: 'month' as const, start: 30 * DAY, end: 40 * DAY };
		const lens = lensSet({ kind: 'period', period }, rows, links, view);
		expect(sorted(lens.traceIds)).toEqual(['course', 'interview', 'offer', 'sprint']);
		expect([...lens.rowIds]).toEqual(['belgrade', 'work']);
		expect(lens.range).toEqual({ start: 30 * DAY, end: 40 * DAY });
		// A moment exactly at the end is the next period's; one at the start is this one's.
		const edge = { unit: 'day' as const, start: 35 * DAY, end: 38 * DAY };
		expect(sorted(lensSet({ kind: 'period', period: edge }, rows, links, view).traceIds)).toEqual([
			'course',
			'offer'
		]);
		const before = { unit: 'day' as const, start: -25 * DAY, end: -15 * DAY };
		expect(sorted(lensSet({ kind: 'period', period: before }, rows, links, view).traceIds)).toEqual(
			['trial']
		);
	});

	it('an explicit set lights those records the ribbon draws and names their rows', () => {
		const lens = lensSet(
			{ kind: 'traces', traceIds: ['dentist', 'sprint', 'hidden'] },
			rows,
			links,
			view
		);
		expect(sorted(lens.traceIds)).toEqual(['dentist', 'sprint']);
		expect([...lens.rowIds]).toEqual(['work', 'unscoped']);
	});

	it('a Kind lights its records that the ribbon draws', () => {
		const lens = lensSet({ kind: 'kind', kindId: 'kind:visit' }, rows, links, view);
		expect(sorted(lens.traceIds)).toEqual(['dentist', 'move', 'offer']);
		expect([...lens.rowIds]).toEqual(['belgrade', 'work', 'unscoped']);
		expect(lensSet({ kind: 'kind', kindId: 'kind:none' }, rows, links, view).traceIds.size).toBe(0);
	});
});

describe('underVeil: what stays under the veil', () => {
	it('for a row hover everything outside the row; otherwise every record the lens does not light', () => {
		const rowHover = { kind: 'row', rowId: 'work' } as const;
		const rowLens = lensSet(rowHover, rows, links, view);
		expect(underVeil(rowHover, rowLens, { traceId: 'offer', rowId: 'belgrade' })).toBe(true);
		expect(underVeil(rowHover, rowLens, { traceId: 'offer', rowId: 'work' })).toBe(false);
		const traceHover = { kind: 'trace', traceId: 'course' } as const;
		const traceLens = lensSet(traceHover, rows, links, view);
		expect(underVeil(traceHover, traceLens, { traceId: 'interview', rowId: 'work' })).toBe(false);
		expect(underVeil(traceHover, traceLens, { traceId: 'dentist', rowId: 'unscoped' })).toBe(true);
	});
});
