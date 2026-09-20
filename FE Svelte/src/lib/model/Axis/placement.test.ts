import { describe, expect, it } from 'vitest';
import { placeLabels } from './placement';
import type { AxisTick } from './types';

/** Cells in canvas pixels: time is the x coordinate. */
const cell = (start: number, end: number, label: string, labelled = true): AxisTick => ({
	unit: 'month',
	start,
	end,
	label,
	labelled
});
const measure = (text: string): number => text.length * 7;
/** A month row: the leftmost label carries the year. */
const text = (tick: AxisTick, leftmost: boolean): string =>
	leftmost ? `${tick.label} 2026` : tick.label;
const place = (cells: AxisTick[]) => placeLabels({ cells, x: (t) => t, measure, text });

describe('placeLabels', () => {
	it('pins the cut cell on a plate while it has room, and the pinned label carries the year', () => {
		const [sep, oct, nov] = place([
			cell(-20, 80, 'сен'),
			cell(80, 180, 'окт'),
			cell(180, 280, 'ноя')
		]);
		expect(sep).toEqual({ text: 'сен 2026', width: 56, x: 10, drawn: true, pinned: true });
		expect(oct).toEqual({ text: 'окт', width: 21, x: 86, drawn: true, pinned: false });
		expect(nov).toMatchObject({ text: 'ноя', drawn: true });
	});

	it('leaves the cut cell unlabelled when the plate would not fit, and the next label takes the edge with the year', () => {
		const [sep, oct, nov] = place([
			cell(-50, 50, 'сен'),
			cell(50, 150, 'окт'),
			cell(150, 250, 'ноя')
		]);
		expect(sep).toMatchObject({ text: 'сен 2026', drawn: false, pinned: false });
		expect(oct).toEqual({ text: 'окт 2026', width: 56, x: 56, drawn: true, pinned: false });
		expect(nov).toMatchObject({ text: 'ноя', x: 156, drawn: true });
	});

	it('draws the leftmost label even when it overflows and drops the neighbour it would run into', () => {
		const placed = place([
			cell(0, 40, 'a'),
			cell(40, 80, 'b'),
			cell(80, 120, 'c'),
			cell(120, 160, 'd')
		]);
		expect(placed.map((p) => p.text)).toEqual(['a 2026', 'b', 'c', 'd']);
		expect(placed.map((p) => p.drawn)).toEqual([true, false, true, true]);
	});

	it('keeps cells off the step in the row with their plain text and no label', () => {
		const placed = place([cell(0, 40, 'янв'), cell(40, 80, 'фев', false), cell(80, 120, 'мар')]);
		expect(placed[1]).toEqual({ text: 'фев', width: 0, x: 46, drawn: false, pinned: false });
		expect(placed[2]).toMatchObject({ text: 'мар', drawn: true, x: 86 });
	});

	it('gives the year to the first drawn label, not to a cut cell that shows nothing', () => {
		const placed = place([cell(-30, 4, 'авг', false), cell(4, 104, 'сен'), cell(104, 204, 'окт')]);
		expect(placed[0]).toMatchObject({ text: 'авг', drawn: false });
		expect(placed[1]).toMatchObject({ text: 'сен 2026', drawn: true, pinned: false, x: 10 });
		expect(placed[2]).toMatchObject({ text: 'окт', drawn: true });
	});
});
