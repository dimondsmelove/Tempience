import { describe, expect, it } from 'vitest';
import type { Caption, LabelBox, MarkBox } from '$lib/model/Labels/types';
import type { RibbonLayout } from '$lib/model/Layout/types';
import type { Mark, ProjectedRow } from '$lib/model/Projection/types';
import { clusterOf, hitAt } from './HitTest';

const mark = (id: string, start: number, end = start): Mark => ({
	id: `${id}@r`,
	traceId: id,
	rowId: 'r',
	kind: 'moment',
	intent: false,
	rollup: false,
	start,
	end,
	label: id,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact'
});
const row: ProjectedRow = {
	id: 'r',
	kind: 'scope',
	scopeId: 'r',
	scopeIds: ['r'],
	name: 'r',
	colours: [],
	depth: 0,
	hasChildren: false,
	expanded: false,
	directCount: 2,
	subtreeCount: 2,
	range: null,
	marks: []
};
const box = (id: string, x0: number, x1: number, start: number, end = start): MarkBox => ({
	mark: mark(id, start, end),
	track: 0,
	x0,
	x1,
	y0: 10,
	y1: 26
});
const layout: RibbonLayout = {
	rows: [
		{
			row,
			y0: 0,
			y1: 52,
			tracks: 1,
			trackHeight: 16,
			boxes: [box('a', 100, 108, 1000, 1000), box('b', 104, 112, 1200, 1300)],
			labels: [{ markId: 'b@r', text: 'b', x: 116, y: 12, width: 30, height: 12, selected: false }],
			rangeX: null
		}
	],
	widthPx: 500,
	heightPx: 416,
	window: { start: 0, end: 5000 },
	pxPerDay: 1,
	x: (t) => t / 10
};

/** A caption as the canvas drew it, from a label the layout placed or one the emphasis forced. */
const drawn = (label: LabelBox, strong = false): Caption => ({
	label,
	strong,
	backing: false,
	alpha: 1
});
/** The layout's own caption of «b», drawn as it is. */
const captions: Caption[][] = [[drawn(layout.rows[0].labels[0])]];

describe('hitAt', () => {
	it('returns captions first, then marks topmost first, then the row', () => {
		expect(hitAt(layout, 120, 18, captions)).toMatchObject({
			type: 'label',
			label: { markId: 'b@r' }
		});
		const hit = hitAt(layout, 106, 18, captions);
		expect(hit?.type).toBe('mark');
		if (hit?.type === 'mark') expect(hit.boxes.map((b) => b.mark.traceId)).toEqual(['b', 'a']);
		expect(hitAt(layout, 99, 18, captions)).toMatchObject({ type: 'mark' });
		expect(hitAt(layout, 300, 40, captions)).toEqual({ type: 'row', rowId: 'r' });
		expect(hitAt(layout, 300, 60, captions)).toBeNull();
		expect(hitAt(layout, -1, 10, captions)).toBeNull();
	});

	it('reads the captions as drawn, not as laid out (owner review 2026-09-19, pack 4, B)', () => {
		// The layout placed «b», but the canvas shows nothing there: the point is the row's.
		expect(hitAt(layout, 120, 18, [[]])).toEqual({ type: 'row', rowId: 'r' });
		// A forced caption of «a», absent from the layout, is drawn wide and in full: it answers.
		const forced = drawn(
			{ markId: 'a@r', text: 'a in full', x: 116, y: 12, width: 60, height: 12, selected: true },
			true
		);
		expect(hitAt(layout, 170, 18, [[forced]])).toMatchObject({
			type: 'label',
			label: { markId: 'a@r', text: 'a in full' }
		});
		// The last drawn caption lies on top: over the same point it wins.
		expect(hitAt(layout, 120, 18, [[drawn(layout.rows[0].labels[0]), forced]])).toMatchObject({
			label: { markId: 'a@r' }
		});
		// A caption drawn in full is wider than the cut one the layout placed: the extra width is a target too.
		const cut = layout.rows[0].labels[0];
		const full = drawn({ ...cut, text: 'b in full', width: 90 });
		expect(hitAt(layout, cut.x + 80, 18, [[cut].map((label) => drawn(label))])).toMatchObject({
			type: 'row'
		});
		expect(hitAt(layout, cut.x + 80, 18, [[full]])).toMatchObject({ type: 'label' });
	});
});

describe('clusterOf', () => {
	it('spans the records under a point and is null for a single record', () => {
		expect(clusterOf([box('a', 0, 1, 10, 20), box('b', 0, 1, 15, 40)])).toEqual({
			traceIds: ['a', 'b'],
			range: { start: 10, end: 40 }
		});
		expect(clusterOf([box('a', 0, 1, 10)])).toBeNull();
	});
});
