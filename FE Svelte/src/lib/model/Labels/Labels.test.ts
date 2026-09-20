import { describe, expect, it } from 'vitest';
import type { Mark } from '$lib/model/Projection/types';
import { placeLabels } from './Labels';
import type { MarkBox } from './types';

const mark = (id: string, label: string, rollup = false, patch: Partial<Mark> = {}): Mark => ({
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
	certainty: 'exact',
	...patch
});
const box = (
	id: string,
	label: string,
	x0: number,
	x1: number,
	track = 0,
	rollup = false,
	patch: Partial<Mark> = {}
): MarkBox => ({
	mark: mark(id, label, rollup, patch),
	track,
	x0,
	x1,
	y0: 10 + Math.max(0, track) * 16,
	y1: 26 + Math.max(0, track) * 16
});
const measure = (text: string): number => text.length * 6;
const options = { measure, selectedTraceId: null, widthPx: 1000, fontPx: 12 };

describe('placeLabels', () => {
	it('places a caption only when the room to the next mark holds the text plus clearance', () => {
		const labels = placeLabels(
			[box('a', 'abcde', 0, 8), box('b', 'xy', 60, 68), box('c', 'zz', 80, 88)],
			options
		);
		// The caption starts after the drawn capsule, the ring's room (3 px) and the 6 px gap.
		expect(labels.map((label) => [label.markId, label.x, label.y])).toEqual([
			['a@r', 17, 12],
			['c@r', 97, 12]
		]);
	});

	it('keeps the caption where it is when the record is selected: the ring finds its room reserved (pack 4, A)', () => {
		const boxes = [box('a', 'abcde', 100, 108), box('b', 'wide', 300, 302)];
		const rest = placeLabels(boxes, options);
		const selected = placeLabels(boxes, { ...options, selectedTraceId: 'a' });
		expect(selected.find((label) => label.markId === 'a@r')!.x).toBe(
			rest.find((label) => label.markId === 'a@r')!.x
		);
		// A 2 px box at a far zoom still draws a 3 px capsule: the caption clears that, not the box.
		expect(rest.find((label) => label.markId === 'b@r')!.x).toBe(300 + 3 + 3 + 6);
		expect(
			placeLabels(boxes, { ...options, selectedTraceId: 'b' }).find(
				(label) => label.markId === 'b@r'
			)!.x
		).toBe(312);
	});

	it('always captions the selected record, even a roll-up; a fuzzy date is captioned after its band', () => {
		const boxes = [box('a', 'long caption', 0, 8, 0, true), box('b', 'x', 10, 18)];
		expect(placeLabels(boxes, options)).toHaveLength(1);
		const selected = placeLabels(boxes, { ...options, selectedTraceId: 'a' });
		expect(selected.map((label) => label.markId)).toEqual(['a@r']);
		expect(selected[0].selected).toBe(true);
		const fuzzy = placeLabels([{ ...box('f', 'fuzzy', 20, 120), y0: 40, y1: 56 }], {
			...options,
			selectedTraceId: 'f'
		});
		expect(fuzzy).toEqual([
			{ markId: 'f@r', text: 'fuzzy', x: 129, y: 42, width: 30, height: 12, selected: true }
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

describe('placeLabels: the caption budget (Q1-A, owner 2026-09-19)', () => {
	/** Five facts a track apart, each with room for its caption; `widthPx` sets the budget. */
	const facts = Array.from({ length: 5 }, (_, i) =>
		box(`f${i}`, `fact ${i}`, 0, 8, i, false, { start: i })
	);

	it('places at most one caption per 200 px of the row and serves the newer records first', () => {
		expect(placeLabels(facts, { ...options, widthPx: 1000 })).toHaveLength(5);
		// The two newest win; the result reads top to bottom for the hit test.
		const two = placeLabels(facts, { ...options, widthPx: 450 });
		expect(two.map((label) => label.markId)).toEqual(['f3@r', 'f4@r']);
		expect(placeLabels(facts, { ...options, widthPx: 120 }).map((label) => label.markId)).toEqual([
			'f4@r'
		]);
	});

	it('serves the classes in order: intentions and «длится», intervals, linked facts, other facts', () => {
		const boxes = [
			box('fact', 'fact', 0, 8, 0, false, { start: 9 }),
			box('linked', 'linked', 0, 8, 1, false, { start: 1 }),
			box('interval', 'interval', 0, 8, 2, false, { kind: 'interval', start: 1 }),
			box('intent', 'intent', 0, 8, 3, false, { intent: true, start: 1 }),
			box('running', 'running', 0, 8, 4, false, { kind: 'interval', open: true, start: 2 })
		];
		const linked = new Set(['linked']);
		const one = placeLabels(boxes, { ...options, widthPx: 120, linked });
		expect(one.map((label) => label.markId)).toEqual(['running@r']);
		const three = placeLabels(boxes, { ...options, widthPx: 600, linked });
		expect(three.map((label) => label.markId).toSorted()).toEqual([
			'intent@r',
			'interval@r',
			'running@r'
		]);
		const four = placeLabels(boxes, { ...options, widthPx: 800, linked });
		expect(four.map((label) => label.markId)).toContain('linked@r');
		expect(four.map((label) => label.markId)).not.toContain('fact@r');
	});

	it('the selected record takes the first place of the budget; a record that lost the budget draws no caption', () => {
		const labels = placeLabels(facts, { ...options, widthPx: 250, selectedTraceId: 'f0' });
		expect(labels.map((label) => [label.markId, label.selected])).toEqual([['f0@r', true]]);
	});

	it('at the «год» tier only intentions, «длится» and intervals are captioned; a roll-up never is', () => {
		const boxes = [
			box('fact', 'fact', 0, 8, 0),
			box('closed', '✓ closed', 0, 8, 1, false, { intent: true, closed: true }),
			box('intent', 'intent', 0, 8, 2, false, { intent: true }),
			box('interval', 'interval', 0, 8, 3, false, { kind: 'interval' }),
			box('rollup', 'rollup', 0, 8, 4, true, { intent: true })
		];
		expect(placeLabels(boxes, { ...options, tier: 'year' }).map((label) => label.markId)).toEqual([
			'intent@r',
			'interval@r'
		]);
		expect(placeLabels(boxes, { ...options, tier: 'month' }).map((label) => label.markId)).toEqual([
			'fact@r',
			'closed@r',
			'intent@r',
			'interval@r'
		]);
		expect(placeLabels(boxes, { ...options, tier: 'week' })).toHaveLength(4);
		// Selected, even a fact at «год»: placed in full.
		expect(
			placeLabels(boxes, { ...options, tier: 'year', selectedTraceId: 'fact' }).map(
				(label) => label.markId
			)
		).toEqual(['intent@r', 'interval@r', 'fact@r']);
	});

	it('cuts a long caption on a word boundary with «…» and measures the cut text; the selected reads in full', () => {
		const long =
			'Спроектировал n8n/Obsidian workflow для голосовых заметок с расшифровкой и тегами';
		const [label] = placeLabels([box('a', long, 0, 8)], options);
		expect(label.text).toBe('Спроектировал n8n/Obsidian workflow для…');
		expect(label.width).toBe(measure(label.text));
		const [selected] = placeLabels([box('a', long, 0, 8)], { ...options, selectedTraceId: 'a' });
		expect(selected.text).toBe(long);
	});
});
