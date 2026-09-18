import { describe, expect, it } from 'vitest';
import { calendarDate, localDateValue, selectedDateValue } from './DateInput';

describe('calendar input values', () => {
	it('round-trips local calendar dates without passing through UTC', () => {
		for (const day of ['2026-09-08', '2024-02-29', '0025-01-03']) {
			expect(localDateValue(calendarDate(day)!)).toBe(day);
		}
		expect(calendarDate('2026-02-29')).toBeUndefined();
		expect(calendarDate('invalid')).toBeUndefined();
	});
	it('preserves the entered clock time when another day is picked', () => {
		const day = calendarDate('2026-09-10')!;
		expect(selectedDateValue(day, '2026-09-08T14:20', true)).toBe('2026-09-10T14:20');
		expect(selectedDateValue(day, '', false)).toBe('2026-09-10');
		expect(selectedDateValue(day, '', true)).toBe('2026-09-10T00:00');
	});
});
