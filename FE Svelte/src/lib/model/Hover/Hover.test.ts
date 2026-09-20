import { describe, expect, it } from 'vitest';
import type { MarkBox } from '$lib/model/Labels/types';
import type { RowLayout } from '$lib/model/Layout/types';
import type { Mark, ProjectedRow } from '$lib/model/Projection/types';
import { canvasHover, hoverKey, sameHover } from './Hover';

const mark = (traceId: string, rowId: string, rollup = false): Mark => ({
	id: `${traceId}@${rowId}`,
	traceId,
	rowId,
	kind: 'moment',
	intent: false,
	rollup,
	start: 0,
	end: 0,
	label: traceId,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact'
});
const row = (id: string, marks: Mark[]): ProjectedRow => ({
	id,
	kind: 'scope',
	scopeId: id,
	scopeIds: [id],
	name: id,
	colours: [],
	depth: 0,
	hasChildren: false,
	expanded: false,
	directCount: marks.length,
	subtreeCount: marks.length,
	range: null,
	marks
});

// «Оффер» is in Белград and Работа; «Собеседование» is a roll-up of Проект shown through Работа.
const rows = [
	row('belgrade', [mark('move', 'belgrade'), mark('offer', 'belgrade')]),
	row('work', [mark('offer', 'work'), mark('interview', 'work', true)]),
	row('dentist', [mark('dentist', 'dentist')])
];

describe('hoverKey and sameHover: one string per target', () => {
	it('names every kind and compares by it', () => {
		expect(hoverKey(null)).toBe('');
		expect(hoverKey({ kind: 'trace', traceId: 'a' })).toBe('trace:a');
		expect(hoverKey({ kind: 'row', rowId: 'r' })).toBe('row:r');
		expect(hoverKey({ kind: 'scope', scopeId: 's' })).toBe('scope:s');
		expect(hoverKey({ kind: 'period', period: { unit: 'month', start: 5, end: 9 } })).toBe(
			'period:month:5'
		);
		expect(hoverKey({ kind: 'traces', traceIds: ['a', 'b'] })).toBe('traces:a,b');
		expect(hoverKey({ kind: 'kind', kindId: 'k' })).toBe('kind:k');
		expect(sameHover(null, null)).toBe(true);
		expect(sameHover({ kind: 'trace', traceId: 'a' }, { kind: 'trace', traceId: 'a' })).toBe(true);
		expect(sameHover({ kind: 'trace', traceId: 'a' }, { kind: 'trace', traceId: 'b' })).toBe(false);
		expect(sameHover({ kind: 'trace', traceId: 'a' }, { kind: 'row', rowId: 'a' })).toBe(false);
		expect(sameHover({ kind: 'row', rowId: 'a' }, null)).toBe(false);
		expect(
			sameHover({ kind: 'traces', traceIds: ['a', 'b'] }, { kind: 'traces', traceIds: ['a', 'b'] })
		).toBe(true);
	});
});

describe('canvasHover: the canvas hovers records, never rows (review 2026-09-19, п. 14/15)', () => {
	const box = (mark: Mark, x0: number): MarkBox => ({
		mark,
		track: 0,
		x0,
		x1: x0 + 6,
		y0: 10,
		y1: 20
	});
	const layoutRows: RowLayout[] = rows.map((row, index) => ({
		row,
		y0: index * 52,
		y1: index * 52 + 52,
		tracks: 1,
		trackHeight: 52,
		boxes: row.marks.map((mark, at) => box(mark, at * 40)),
		labels: row.marks.map((mark, at) => ({
			markId: mark.id,
			text: mark.label,
			x: at * 40 + 8,
			y: 8,
			width: 30,
			height: 14,
			selected: false
		})),
		rangeX: null
	}));

	it('a mark or its caption hovers the record', () => {
		const offer = layoutRows[0].boxes[1];
		expect(canvasHover({ type: 'mark', rowId: 'belgrade', boxes: [offer] }, layoutRows)).toEqual({
			kind: 'trace',
			traceId: 'offer'
		});
		expect(
			canvasHover({ type: 'label', rowId: 'work', label: layoutRows[1].labels[1] }, layoutRows)
		).toEqual({ kind: 'trace', traceId: 'interview' });
	});

	it('the empty band of a row, a stale caption and no hit hover nothing', () => {
		expect(canvasHover({ type: 'row', rowId: 'work' }, layoutRows)).toBeNull();
		expect(
			canvasHover(
				{
					type: 'label',
					rowId: 'work',
					label: { ...layoutRows[1].labels[0], markId: 'gone@work' }
				},
				layoutRows
			)
		).toBeNull();
		expect(canvasHover(null, layoutRows)).toBeNull();
	});
});
