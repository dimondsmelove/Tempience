import { describe, expect, it } from 'vitest';
import { addDaysISO, weekEndISO, weekStartISO, weekWindowUtc } from './week';

describe('week helpers', () => {
	it('weekStartISO returns Monday', () => {
		expect(weekStartISO('2026-07-10')).toBe('2026-07-06');
	});

	it('weekEndISO is Sunday', () => {
		expect(weekEndISO('2026-07-06')).toBe('2026-07-12');
	});

	it('addDaysISO shifts dates', () => {
		expect(addDaysISO('2026-07-06', 7)).toBe('2026-07-13');
	});

	it('weekWindowUtc covers full week', () => {
		const w = weekWindowUtc('2026-07-06');
		expect(w.from).toBe('2026-07-06T00:00:00.000Z');
		expect(w.to).toBe('2026-07-13T00:00:00.000Z');
	});
});
