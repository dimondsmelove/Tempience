import { describe, expect, it } from 'vitest';
import type { Mark } from '$lib/model/Projection/types';
import {
	captionBudget,
	captionClass,
	captionTier,
	linkedTraceIds,
	rankForBudget,
	tierAdmits,
	truncateCaption
} from './budget';
import { CAPTION_MAX_CHARS } from './constants';
import type { MarkBox } from './types';

const mark = (id: string, patch: Partial<Mark> = {}): Mark => ({
	id: `${id}@r`,
	traceId: id,
	rowId: 'r',
	kind: 'moment',
	intent: false,
	rollup: false,
	start: 0,
	end: 0,
	label: id,
	timeLabel: '',
	precision: 'day',
	certainty: 'exact',
	...patch
});
const box = (id: string, patch: Partial<Mark> = {}): MarkBox => ({
	mark: mark(id, patch),
	track: 0,
	x0: 0,
	x1: 8,
	y0: 10,
	y1: 26
});
const none: ReadonlySet<string> = new Set();

describe('captionClass (Q1-A п. 1)', () => {
	it('open intentions and «длится» come first, then intervals, linked facts, other facts', () => {
		expect(captionClass(mark('a', { intent: true }), none)).toBe('intention');
		expect(captionClass(mark('a', { kind: 'interval', open: true }), none)).toBe('intention');
		expect(captionClass(mark('a', { kind: 'interval' }), none)).toBe('interval');
		expect(captionClass(mark('a'), new Set(['a']))).toBe('linked');
		expect(captionClass(mark('a'), none)).toBe('fact');
	});

	it('a closed intention and a fuzzy date are facts; a fuzzy intention still open is an intention', () => {
		expect(captionClass(mark('a', { intent: true, closed: true }), none)).toBe('fact');
		expect(captionClass(mark('a', { kind: 'fuzzy' }), none)).toBe('fact');
		expect(captionClass(mark('a', { kind: 'fuzzy', intent: true }), none)).toBe('intention');
	});
});

describe('captionTier and tierAdmits (Q1-A п. 3)', () => {
	it('maps the window span to the tier: the toolbar presets land as named', () => {
		expect(captionTier(1095)).toBe('year');
		expect(captionTier(365)).toBe('year');
		expect(captionTier(300)).toBe('year');
		expect(captionTier(299)).toBe('month');
		expect(captionTier(91)).toBe('month');
		expect(captionTier(30)).toBe('month');
		expect(captionTier(19)).toBe('week');
		expect(captionTier(7)).toBe('week');
		expect(captionTier(2)).toBe('week');
	});

	it('«год» captions intentions, «длится» and intervals only; the finer tiers admit facts', () => {
		expect(tierAdmits('year', 'intention')).toBe(true);
		expect(tierAdmits('year', 'interval')).toBe(true);
		expect(tierAdmits('year', 'linked')).toBe(false);
		expect(tierAdmits('year', 'fact')).toBe(false);
		expect(tierAdmits('month', 'fact')).toBe(true);
		expect(tierAdmits('week', 'fact')).toBe(true);
	});
});

describe('captionBudget', () => {
	it('is one caption per 200 px of the row, never fewer than one', () => {
		expect(captionBudget(1000)).toBe(5);
		expect(captionBudget(1199)).toBe(5);
		expect(captionBudget(399)).toBe(1);
		expect(captionBudget(120)).toBe(1);
	});
});

describe('rankForBudget', () => {
	it('serves the selected first, then by class, ties newer first, then by id', () => {
		const boxes = [
			box('fact-old', { start: 1 }),
			box('fact-new', { start: 5 }),
			box('interval', { kind: 'interval', start: 2 }),
			box('linked', { start: 3 }),
			box('intent', { intent: true, start: 0 }),
			box('running', { kind: 'interval', open: true, start: 4 }),
			box('same-a', { start: 5 }),
			box('same-b', { start: 5 })
		];
		expect(rankForBudget(boxes, null, new Set(['linked'])).map((b) => b.mark.traceId)).toEqual([
			'running',
			'intent',
			'interval',
			'linked',
			'fact-new',
			'same-a',
			'same-b',
			'fact-old'
		]);
		expect(rankForBudget(boxes, 'fact-old', new Set(['linked']))[0].mark.traceId).toBe('fact-old');
	});
});

describe('truncateCaption (Q1-A п. 2)', () => {
	it('leaves a text within 44 characters alone', () => {
		const text = 'Спроектировал workflow для голосовых заметок';
		expect(text.length).toBeLessThanOrEqual(CAPTION_MAX_CHARS);
		expect(truncateCaption(text)).toBe(text);
	});

	it('cuts a longer text on the last word boundary within the limit and ends it with «…»', () => {
		const text =
			'Отметил сложности с использованием аэрогриля и предпочтение полуфабрикатов на неделе';
		const cut = truncateCaption(text);
		expect(cut).toBe('Отметил сложности с использованием аэрогриля…');
		expect(cut.length).toBeLessThanOrEqual(CAPTION_MAX_CHARS + 1);
		expect(text.startsWith(cut.slice(0, -1))).toBe(true);
	});

	it('cuts hard at the limit when the only word boundary would leave a stub', () => {
		const text = 'https://example.org/a-very-long-path-without-any-spaces-in-it-anywhere';
		expect(truncateCaption(text)).toBe(`${text.slice(0, CAPTION_MAX_CHARS)}…`);
		const stub = `Ab ${'x'.repeat(60)}`;
		expect(truncateCaption(stub)).toBe(`${stub.slice(0, CAPTION_MAX_CHARS)}…`);
	});

	it('counts characters, not UTF-16 units, and drops the space before the ellipsis', () => {
		expect(truncateCaption('a b c d e', 3)).toBe('a b…');
		expect(truncateCaption('🙂'.repeat(50), 44)).toBe(`${'🙂'.repeat(44)}…`);
	});
});

describe('linkedTraceIds', () => {
	it('collects both ends of every explicit link', () => {
		expect([
			...linkedTraceIds([
				{ fromTraceId: 'a', toTraceId: 'b', kind: 'part_of' },
				{ fromTraceId: 'c', toTraceId: 'a', kind: 'part_of' }
			])
		]).toEqual(['a', 'b', 'c']);
	});
});
