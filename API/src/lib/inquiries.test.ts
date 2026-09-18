import { describe, expect, it } from 'vitest';
import { createInquirySchema } from '@chronograph/shared';
import { buildInquiryFromSuggestedLink } from './inquiry-from-link';

describe('createInquirySchema', () => {
	it('accepts link_suggestion inquiry', () => {
		const parsed = createInquirySchema.parse({
			trigger_kind: 'link_suggestion',
			subject_kind: 'link',
			subject_uid: '550e8400-e29b-41d4-a716-446655440000',
			wording: 'Связать эти моменты?'
		});
		expect(parsed.trigger_kind).toBe('link_suggestion');
	});
});

describe('buildInquiryFromSuggestedLink', () => {
	it('builds replaced_by wording', () => {
		const draft = buildInquiryFromSuggestedLink({
			uid: '550e8400-e29b-41d4-a716-446655440002',
			from_uid: '550e8400-e29b-41d4-a716-446655440000',
			to_uid: '550e8400-e29b-41d4-a716-446655440001',
			link_kind: 'replaced_by'
		});
		expect(draft.wording).toContain('Связать');
		expect(draft.trigger_kind).toBe('link_suggestion');
	});
});
