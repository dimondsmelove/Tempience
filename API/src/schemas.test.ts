import { describe, expect, it } from 'vitest';
import { createAreaSchema } from '@chronograph/shared';

describe('createAreaSchema', () => {
	it('accepts valid name', () => {
		expect(createAreaSchema.parse({ name: 'Work' }).name).toBe('Work');
	});

	it('rejects empty name', () => {
		expect(() => createAreaSchema.parse({ name: '' })).toThrow();
	});
});
