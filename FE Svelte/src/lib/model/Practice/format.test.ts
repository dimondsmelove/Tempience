import { describe, expect, it } from 'vitest';
import { weekDateLabel } from './format';

describe('practice week labels', () => {
	it('shows the compact localised start date', () => {
		expect(weekDateLabel('2026-10-26', 'en')).toBe('10/26');
		expect(weekDateLabel('2026-10-26', 'ru')).toBe('26.10');
	});
});
