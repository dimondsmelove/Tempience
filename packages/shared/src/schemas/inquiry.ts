import { z } from 'zod';
import { linkEvidenceRefSchema } from './link';
import { timestampsSchema, uidSchema } from './common';

export const inquiryTriggerKindSchema = z.enum([
	'intent_drift',
	'pattern_repeat',
	'continuity_phase',
	'review',
	'ai_opt_in',
	'link_suggestion'
]);

export const inquiryStatusSchema = z.enum(['open', 'answered', 'deferred', 'dismissed']);

export const inquirySubjectKindSchema = z.enum(['link', 'trace', 'continuity']);

export const inquiryResponseKindSchema = z.enum(['accept', 'reject', 'defer', 'unknown']);

export const inquirySchema = z
	.object({
		uid: uidSchema,
		trigger_kind: inquiryTriggerKindSchema,
		subject_kind: inquirySubjectKindSchema,
		subject_uid: uidSchema,
		wording: z.string().min(1).max(2000),
		options: z.array(z.string().min(1).max(200)).default([]),
		evidence_refs: z.array(linkEvidenceRefSchema).default([]),
		user_response_kind: inquiryResponseKindSchema.nullable(),
		user_response_text: z.string().max(2000).nullable(),
		status: inquiryStatusSchema,
		owner_uid: z.string().min(1),
		space_uid: z.string().min(1)
	})
	.merge(timestampsSchema);

export const createInquirySchema = z.object({
	trigger_kind: inquiryTriggerKindSchema,
	subject_kind: inquirySubjectKindSchema,
	subject_uid: uidSchema,
	wording: z.string().min(1).max(2000),
	options: z.array(z.string().min(1).max(200)).optional(),
	evidence_refs: z.array(linkEvidenceRefSchema).optional(),
	owner_uid: z.string().min(1).default('local-user'),
	space_uid: z.string().min(1).default('personal')
});

export const answerInquirySchema = z.object({
	response_kind: inquiryResponseKindSchema,
	response_text: z.string().max(2000).optional(),
	assert_link_label: z.string().max(500).nullable().optional()
});

export const inquiryListQuerySchema = z.object({
	status: inquiryStatusSchema.optional(),
	subject_uid: uidSchema.optional(),
	subject_kind: inquirySubjectKindSchema.optional(),
	trigger_kind: inquiryTriggerKindSchema.optional()
});

export type Inquiry = z.infer<typeof inquirySchema>;
export type CreateInquiryInput = z.infer<typeof createInquirySchema>;
export type AnswerInquiryInput = z.infer<typeof answerInquirySchema>;
