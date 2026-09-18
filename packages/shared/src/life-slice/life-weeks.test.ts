import { describe, expect, it } from 'vitest';
import { buildLifeWeeks, resolveLifeMapWeekRange, weekStartISO } from './life-weeks';

describe('life-weeks', () => {
	it('weekStartISO returns Monday', () => {
		expect(weekStartISO('2026-07-10')).toBe('2026-07-06');
	});

	it('buildLifeWeeks marks current, past, and future', () => {
		const weeks = buildLifeWeeks({
			birthDate: '2026-07-01',
			horizonDate: '2026-08-01',
			currentWeekStart: '2026-07-06',
			fromWeek: '2026-06-29',
			toWeek: '2026-07-13'
		});

		expect(weeks).toHaveLength(3);
		expect(weeks[0]).toMatchObject({ week_start: '2026-06-29', is_past: true });
		expect(weeks[1]).toMatchObject({ week_start: '2026-07-06', is_current: true });
		expect(weeks[2]).toMatchObject({ week_start: '2026-07-13', is_future: true });
	});

	it('resolveLifeMapWeekRange clamps to life grid', () => {
		const range = resolveLifeMapWeekRange({
			birthDate: '1990-03-15',
			lifeHorizonYears: 100,
			from: '1980-01-01',
			to: '2200-01-01'
		});

		expect(range.fromWeek).toBe(weekStartISO('1990-03-15'));
		expect(range.horizonDate).toBe('2090-03-15');
		expect(range.toWeek).toBe(weekStartISO('2090-03-15'));
	});
});
