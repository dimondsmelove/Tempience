import { describe, expect, it } from 'vitest';
import { DEFAULT_LIFE_HORIZON_YEARS, horizonDateISO } from './horizon';

describe('horizonDateISO', () => {
	it('adds years to birth date', () => {
		expect(horizonDateISO('1990-03-15', DEFAULT_LIFE_HORIZON_YEARS)).toBe('2090-03-15');
	});

	it('handles year boundary', () => {
		expect(horizonDateISO('2000-01-01', 1)).toBe('2001-01-01');
	});
});
