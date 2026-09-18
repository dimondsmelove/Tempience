import { describe, expect, it } from 'vitest';
import type { MarkBox } from '$lib/model/Labels/types';
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
	name: 'r',
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

describe('hitAt', () => {
	it('returns captions first, then marks topmost first, then the row', () => {
		expect(hitAt(layout, 120, 18)).toMatchObject({ type: 'label', label: { markId: 'b@r' } });
		const hit = hitAt(layout, 106, 18);
		expect(hit?.type).toBe('mark');
		if (hit?.type === 'mark') expect(hit.boxes.map((b) => b.mark.traceId)).toEqual(['b', 'a']);
		expect(hitAt(layout, 99, 18)).toMatchObject({ type: 'mark' });
		expect(hitAt(layout, 300, 40)).toEqual({ type: 'row', rowId: 'r' });
		expect(hitAt(layout, 300, 60)).toBeNull();
		expect(hitAt(layout, -1, 10)).toBeNull();
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
