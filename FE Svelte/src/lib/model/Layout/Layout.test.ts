import { describe, expect, it } from 'vitest';
import { DAY_MS, ROW_HEIGHT_MIN_PX } from '$lib/model/Packing/constants';
import type { Mark, ProjectedRow } from '$lib/model/Projection/types';
import { layoutRibbon } from './Layout';

const day = (n: number): number => Date.UTC(2026, 0, 1) + n * DAY_MS;
const mark = (id: string, kind: Mark['kind'], from: number, to = from, label = id): Mark => ({
	id: `${id}@r`,
	traceId: id,
	rowId: 'r',
	kind,
	intent: false,
	rollup: false,
	start: day(from),
	end: day(to),
	label,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact'
});
const row = (id: string, marks: Mark[]): ProjectedRow => ({
	id,
	kind: 'scope',
	scopeId: id,
	name: id,
	depth: 0,
	hasChildren: false,
	expanded: false,
	directCount: marks.length,
	subtreeCount: marks.length,
	range: marks.length ? { start: day(0), end: day(10) } : null,
	marks
});
const options = {
	window: { start: day(0), end: day(100) },
	widthPx: 1000,
	measure: (text: string) => text.length * 6,
	selectedTraceId: null
};

describe('layoutRibbon', () => {
	it('fills the available canvas height while preserving rows and hit geometry', () => {
		const rows = [row('a', [mark('m', 'moment', 10)]), row('b', [])];
		const normal = layoutRibbon(rows, options);
		const filled = layoutRibbon(rows, { ...options, minHeightPx: 640 });
		expect(filled.heightPx).toBe(640);
		expect(filled.rows).toEqual(normal.rows);
		expect(layoutRibbon(rows, { ...options, minHeightPx: 20 }).heightPx).toBe(normal.heightPx);
	});

	it('stacks rows of 52 px and centres a single track above the underlay reserve', () => {
		const layout = layoutRibbon([row('a', [mark('m', 'moment', 10)]), row('b', [])], options);
		expect(layout.rows.map((r) => [r.y0, r.y1])).toEqual([
			[0, ROW_HEIGHT_MIN_PX],
			[ROW_HEIGHT_MIN_PX, 2 * ROW_HEIGHT_MIN_PX]
		]);
		expect(layout.rows[0]).toMatchObject({ tracks: 1, trackHeight: 16 });
		const box = layout.rows[0].boxes[0];
		expect(box.x1 - box.x0).toBe(8);
		expect(box.x0 + 4).toBeCloseTo(100);
		expect(box.y0).toBe(15);
		expect(layout.heightPx).toBe(104);
	});

	it('gives colliding marks new tracks and fuzzy dates an underlay without a track', () => {
		const layout = layoutRibbon(
			[
				row('a', [
					mark('p', 'moment', 10),
					mark('q', 'moment', 10.2),
					mark('f', 'fuzzy', 0, 31, 'март')
				])
			],
			options
		);
		const [p, q, f] = layout.rows[0].boxes;
		expect([p.track, q.track, f.track]).toEqual([0, 1, -1]);
		expect(layout.rows[0].trackHeight).toBe(11);
		expect(q.y0 - p.y0).toBe(9);
		expect([f.x0, f.x1, f.y0, f.y1]).toEqual([0, 310, 45, 48]);
		expect(layout.rows[0].labels.map((label) => label.markId)).toEqual(['p@r']);
	});

	it('stacks taller rows with a wider pitch, so neighbouring tracks stop hiding captions', () => {
		const rows = [
			row('a', [mark('p', 'moment', 10, 10, 'первая'), mark('q', 'moment', 10.2, 10.2, 'вторая')]),
			row('b', [])
		];
		const tight = layoutRibbon(rows, options);
		expect(tight.rows[0].labels).toHaveLength(1);
		const tall = layoutRibbon(rows, { ...options, rowHeightPx: 100 });
		expect(tall.rows.map((r) => [r.y0, r.y1])).toEqual([
			[0, 100],
			[100, 200]
		]);
		expect(tall.heightPx).toBe(200);
		const [p, q] = tall.rows[0].boxes;
		expect(q.y0 - p.y0).toBe(18);
		expect(tall.rows[0].trackHeight).toBe(16);
		expect(tall.rows[0].labels.map((label) => label.text)).toEqual(['первая', 'вторая']);
		expect(layoutRibbon(Array(5).fill(rows[1]), { ...options, rowHeightPx: 100 }).heightPx).toBe(
			500
		);
	});

	it('packs a tall Scope beyond five tracks without moving marks outside its row', () => {
		const marks = Array.from({ length: 20 }, (_, i) => mark(String(i), 'moment', 10));
		for (const fontPx of [12, 30]) {
			const layout = layoutRibbon([row('a', marks)], { ...options, rowHeightPx: 600, fontPx });
			expect(layout.rows[0].tracks).toBeGreaterThan(5);
			for (const box of layout.rows[0].boxes) {
				expect(box.y0).toBeGreaterThanOrEqual(0);
				expect(box.y1).toBeLessThan(600);
			}
		}
	});

	it('captions marks with room and clips the Scope range to the canvas', () => {
		const layout = layoutRibbon([row('a', [mark('m', 'interval', 20, 30, 'встреча')])], {
			...options,
			window: { start: day(25), end: day(125) }
		});
		const [box] = layout.rows[0].boxes;
		expect(box.x0).toBeCloseTo(-50);
		expect(box.x1).toBeCloseTo(50);
		expect(layout.rows[0].labels[0]).toMatchObject({ text: 'встреча', x: 54 });
		expect(layout.rows[0].rangeX).toBeNull();
		expect(layout.pxPerDay).toBe(10);
	});
});

it('keeps enlarged captions inside a minimum-height row', () => {
	const marks = Array.from({ length: 5 }, (_, i) => mark(String(i), 'moment', 10));
	const layout = layoutRibbon([row('a', marks)], {
		...options,
		rowHeightPx: 52,
		fontPx: 30,
		selectedTraceId: '0'
	});
	expect(layout.rows[0].labels.length).toBeGreaterThan(0);
	for (const label of layout.rows[0].labels) {
		expect(label.y).toBeGreaterThanOrEqual(0);
		expect(label.y + label.height).toBeLessThanOrEqual(52);
	}
});
