import { describe, expect, it } from 'vitest';
import { apiUrl } from './client';

describe('apiUrl', () => {
	it('joins base url and path', () => {
		expect(apiUrl('/api/v1/health')).toBe('/api/v1/health');
	});
});
