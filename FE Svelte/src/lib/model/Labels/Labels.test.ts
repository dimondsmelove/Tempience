import { describe, expect, it } from 'vitest';
import type { Mark } from '$lib/model/Projection/types';
import { placeLabels } from './Labels';
import type { MarkBox } from './types';

const mark = (id: string, label: string, rollup = false): Mark => ({
	id: `${id}@r`,
	traceId: id,
	rowId: 'r',
	kind: 'moment',
	intent: false,
	rollup,
	start: 0,
	end: 0,
	label,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact'
});
const box = (
	id: string,
	label: string,
	x0: number,
	x1: number,
	track = 0,
	rollup = false
): MarkBox => ({
	mark: mark(id, label, rollup),
	track,
	x0,
	x1,
	y0: 10,
	y1: 26
});
const measure = (text: string): number => text.length * 6;
const options = { measure, selectedTraceId: null, widthPx: 1000, fontPx: 12 };

describe('placeLabels', () => {
	it('places a caption only when the room to the next mark holds the text plus clearance', () => {
		const labels = placeLabels(
			[box('a', 'abcde', 0, 8), box('b', 'xy', 60, 68), box('c', 'zz', 80, 88)],
			options
		);
		expect(labels.map((label) => [label.markId, label.x, label.y])).toEqual([
			['a@r', 12, 12],
			['c@r', 92, 12]
		]);
	});

	it('always captions the selected record, even a roll-up or a fuzzy underlay', () => {
		const boxes = [box('a', 'long caption', 0, 8, 0, true), box('b', 'x', 10, 18)];
		expect(placeLabels(boxes, options)).toHaveLength(1);
		const selected = placeLabels(boxes, { ...options, selectedTraceId: 'a' });
		expect(selected.map((label) => label.markId)).toEqual(['a@r']);
		expect(selected[0].selected).toBe(true);
		const fuzzy = placeLabels([{ ...box('f', 'fuzzy', 20, 120), track: -1, y0: 40, y1: 44 }], {
			...options,
			selectedTraceId: 'f'
		});
		expect(fuzzy).toEqual([
			{ markId: 'f@r', text: 'fuzzy', x: 24, y: 26, width: 30, height: 12, selected: true }
		]);
	});

	it('never lets captions overlap across tracks', () => {
		const labels = placeLabels(
			[box('a', 'first caption', 0, 8, 0), { ...box('b', 'second', 4, 12, 1), y0: 19, y1: 30 }],
			options
		);
		expect(labels.map((label) => label.markId)).toEqual(['a@r']);
	});

	it('skips captions of marks outside the canvas', () => {
		expect(placeLabels([box('a', 'a', -100, -92), box('b', 'b', 1001, 1009)], options)).toEqual([]);
	});
});
