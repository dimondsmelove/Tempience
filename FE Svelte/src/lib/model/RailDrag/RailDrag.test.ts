import { describe, expect, it } from 'vitest';
import { dragTarget } from './RailDrag';
import type { RowBand } from './types';

/** Three lane rows of 40 px, one after another. */
const rows: RowBand[] = [
	{ top: 0, bottom: 40 },
	{ top: 40, bottom: 80 },
	{ top: 80, bottom: 120 }
];
/** The first lane unfolded: its two children fill 40–120, the second lane starts at 120. */
const unfolded: RowBand[] = [
	{ top: 0, bottom: 40 },
	{ top: 120, bottom: 160 },
	{ top: 160, bottom: 200 }
];

describe('dragTarget (research «Открытые вопросы» п. 1, mock v6.2)', () => {
	it('the middle 44 % of a row merges, the edges insert above or below', () => {
		expect(dragTarget(60, rows)).toEqual({ kind: 'merge', index: 1 });
		expect(dragTarget(51.2, rows)).toEqual({ kind: 'merge', index: 1 });
		expect(dragTarget(68.7, rows)).toEqual({ kind: 'merge', index: 1 });
		expect(dragTarget(51, rows)).toEqual({ kind: 'insert', index: 1 });
		expect(dragTarget(68.8, rows)).toEqual({ kind: 'insert', index: 2 });
		expect(dragTarget(45, rows)).toEqual({ kind: 'insert', index: 1 });
		expect(dragTarget(75, rows)).toEqual({ kind: 'insert', index: 2 });
		// The first row's top edge and the last row's bottom edge are the ends of the list.
		expect(dragTarget(3, rows)).toEqual({ kind: 'insert', index: 0 });
		expect(dragTarget(118, rows)).toEqual({ kind: 'insert', index: 3 });
	});

	it('above the list inserts first, below it last', () => {
		expect(dragTarget(-30, rows)).toEqual({ kind: 'insert', index: 0 });
		expect(dragTarget(500, rows)).toEqual({ kind: 'insert', index: 3 });
		expect(dragTarget(10, [])).toBeNull();
	});

	it('the boundary holds the previous target for ±2 px: no flicker in the dead zone', () => {
		const merge = { kind: 'merge', index: 1 } as const;
		const insert = { kind: 'insert', index: 1 } as const;
		const below = { kind: 'insert', index: 2 } as const;
		// Coming from a merge, the zone is 2 px wider on both sides.
		expect(dragTarget(49.5, rows, { previous: merge })).toEqual(merge);
		expect(dragTarget(48, rows, { previous: merge })).toEqual(insert);
		expect(dragTarget(70, rows, { previous: merge })).toEqual(merge);
		expect(dragTarget(71, rows, { previous: merge })).toEqual(below);
		// Coming from an insert at either edge, the zone is 2 px narrower.
		expect(dragTarget(52, rows, { previous: insert })).toEqual(insert);
		expect(dragTarget(54, rows, { previous: insert })).toEqual(merge);
		expect(dragTarget(67.5, rows, { previous: below })).toEqual(below);
		expect(dragTarget(66, rows, { previous: below })).toEqual(merge);
		// A previous target on another row does not move this row's boundary.
		expect(dragTarget(49.5, rows, { previous: { kind: 'merge', index: 0 } })).toEqual(insert);
	});

	it('Alt merges with the row under the pointer whatever the zone, and with the nearest row outside the list', () => {
		expect(dragTarget(45, rows, { alt: true })).toEqual({ kind: 'merge', index: 1 });
		expect(dragTarget(3, rows, { alt: true })).toEqual({ kind: 'merge', index: 0 });
		expect(dragTarget(-30, rows, { alt: true })).toEqual({ kind: 'merge', index: 0 });
		expect(dragTarget(500, rows, { alt: true })).toEqual({ kind: 'merge', index: 2 });
	});

	it('the children of an unfolded lane are its block: an insert there goes after it, Alt merges with the parent', () => {
		expect(dragTarget(70, unfolded)).toEqual({ kind: 'insert', index: 1 });
		expect(dragTarget(119, unfolded)).toEqual({ kind: 'insert', index: 1 });
		expect(dragTarget(70, unfolded, { alt: true })).toEqual({ kind: 'merge', index: 0 });
		expect(dragTarget(140, unfolded)).toEqual({ kind: 'merge', index: 1 });
	});

	it('the member rows of an unfolded merged lane (C5) are its block too: never a target, an insert there goes after the lane', () => {
		// The first lane is the merged row, unfolded: its two member rows fill 40–120 and carry no band.
		expect(dragTarget(60, unfolded, { source: 2 })).toEqual({ kind: 'insert', index: 1 });
		expect(dragTarget(100, unfolded, { source: 2 })).toEqual({ kind: 'insert', index: 1 });
		expect(dragTarget(60, unfolded, { source: 2, alt: true })).toEqual({ kind: 'merge', index: 0 });
		expect(dragTarget(20, unfolded, { source: 2 })).toEqual({ kind: 'merge', index: 0 });
	});

	it('the dragged lane is no target: not to merge with, not to insert beside', () => {
		expect(dragTarget(60, rows, { source: 1 })).toBeNull();
		expect(dragTarget(45, rows, { source: 1 })).toBeNull();
		expect(dragTarget(75, rows, { source: 1 })).toBeNull();
		expect(dragTarget(60, rows, { source: 1, alt: true })).toBeNull();
		expect(dragTarget(20, rows, { source: 1 })).toEqual({ kind: 'merge', index: 0 });
		expect(dragTarget(3, rows, { source: 1 })).toEqual({ kind: 'insert', index: 0 });
		expect(dragTarget(118, rows, { source: 1 })).toEqual({ kind: 'insert', index: 3 });
		// A child row has no lane of its own: every lane is a target, its parent's too.
		expect(dragTarget(60, unfolded, { source: null, alt: true })).toEqual({
			kind: 'merge',
			index: 0
		});
	});
});
