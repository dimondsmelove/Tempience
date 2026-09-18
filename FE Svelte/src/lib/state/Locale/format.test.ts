import { describe, expect, it } from 'vitest';
import { dateTimeFormat, formatDay, numberFormat } from './format';

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
		const options = { dateStyle: 'medium', timeZone: 'UTC' } as const;
		expect(dateTimeFormat('en', options)).toBe(dateTimeFormat('en', { ...options }));
	});
});
