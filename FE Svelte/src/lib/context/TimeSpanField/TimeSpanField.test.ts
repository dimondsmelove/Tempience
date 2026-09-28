import { render } from 'svelte/server';
import { describe, expect, it, vi } from 'vitest';
import { selectionOf, spanOf } from './selection';
import TimeSpanField from './TimeSpanField.svelte';

const local = (y: number, m: number, d: number, h = 0, min = 0) =>
	new Date(y, m - 1, d, h, min).getTime();

describe('a chapter’s span through the TimeInput component', () => {
	it('opens as an exact selection to the minute', () => {
		expect(selectionOf({ start: local(2019, 10, 10, 14, 30), end: null })).toEqual({
			start: local(2019, 10, 10, 14, 30),
			end: null,
			timed: true
		});
	});
	it('reads a date without a time as its midnight, and drops an end the field does not take', () => {
		const dayOnly = { start: local(2019, 10, 10, 12), end: local(2019, 11, 1, 12), timed: false };
		expect(spanOf(dayOnly, true)).toEqual({ start: local(2019, 10, 10), end: local(2019, 11, 1) });
		expect(spanOf(dayOnly, false)).toEqual({ start: local(2019, 10, 10), end: null });
		const timed = { start: local(2019, 10, 10, 9, 15), end: null, timed: true };
		expect(spanOf(timed, true)).toEqual({ start: local(2019, 10, 10, 9, 15), end: null });
		expect(spanOf({ ...timed, end: local(2019, 11, 1), ongoing: true }, true).end).toBeNull();
	});
});

describe('a chapter time field', () => {
	it('shows its label and a trigger with the start, nothing chosen in place yet', () => {
		const { body } = render(TimeSpanField, {
			props: {
				label: 'Начало',
				span: { start: new Date(2026, 8, 3).getTime(), end: null },
				testId: 'chapter-time',
				onchange: vi.fn()
			}
		});
		expect(body).toContain('Начало');
		expect(body).toContain('data-testid="chapter-time-open"');
		expect(body).toContain('span-trigger');
		expect(body).not.toContain('time-picker');
	});
});
