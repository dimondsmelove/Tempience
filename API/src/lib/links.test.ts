import { describe, expect, it } from 'vitest';
import { createLinkSchema } from '@chronograph/shared';

describe('createLinkSchema', () => {
	const base = {
		from_kind: 'trace' as const,
		from_uid: '550e8400-e29b-41d4-a716-446655440000',
		to_kind: 'trace' as const,
		to_uid: '550e8400-e29b-41d4-a716-446655440001',
		provenance: 'suggested' as const,
		creator: 'system' as const
	};

	it('accepts suggested link between traces', () => {
		const parsed = createLinkSchema.parse(base);
		expect(parsed.provenance).toBe('suggested');
	});

	it('accepts human-asserted link on create', () => {
		const parsed = createLinkSchema.parse({
			...base,
			provenance: 'asserted',
			creator: 'user'
		});
		expect(parsed.provenance).toBe('asserted');
	});

	it('rejects invalid provenance', () => {
		expect(() =>
			createLinkSchema.parse({
				...base,
				provenance: 'magic'
			})
		).toThrow();
	});
});
