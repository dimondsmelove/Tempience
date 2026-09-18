import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('Triplit ids', () => {
	it('creates a UUID v4 compatible id', () => {
		expect(createId()).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		);
	});
});
