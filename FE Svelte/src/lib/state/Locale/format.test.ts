import { describe, expect, it } from 'vitest';
import { dateTimeFormat, formatDay, formatMoment, numberFormat } from './format';

describe('the formatters of the interface languages', () => {
	it('formats numbers and days per language, reusing one formatter per set of options', () => {
		expect(numberFormat('ru').format(73.8)).toBe('73,8');
		expect(numberFormat('en').format(73.8)).toBe('73.8');
		expect(numberFormat('ru')).toBe(numberFormat('ru'));
		expect(numberFormat('ru')).not.toBe(numberFormat('en'));
		expect(numberFormat('ru', { maximumFractionDigits: 1 })).not.toBe(numberFormat('ru'));
		const day = Date.UTC(2026, 8, 6);
		expect(formatDay('ru', day)).toBe('6 сент. 2026');
		expect(formatDay('en', day)).toBe('6 Sept 2026');
		// A day of the current year leaves the year out; another year's keeps it; the zone is honoured.
		const now = Date.UTC(2026, 8, 27);
		expect(formatDay('ru', day, { year: 'current', now })).toBe('6 сент.');
		expect(formatDay('ru', Date.UTC(2019, 9, 10), { year: 'current', now })).toBe('10 окт. 2019');
		expect(formatDay('en', Date.UTC(2019, 9, 9, 22), { timeZone: 'Europe/Belgrade' })).toBe(
			'10 Oct 2019'
		);
		expect(
			formatMoment('ru', Date.UTC(2026, 8, 27, 22), { timeZone: 'Europe/Belgrade', now })
		).toBe('пн, 28 сент., 00:00');
		const options = { dateStyle: 'medium', timeZone: 'UTC' } as const;
		expect(dateTimeFormat('en', options)).toBe(dateTimeFormat('en', { ...options }));
	});
});
