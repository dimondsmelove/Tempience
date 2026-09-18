/** @deprecated Use scope-traces junction. Removed in target API F4. SSOT: vision/core.md */
import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const linkEntityKindSchema = z.enum(['trace', 'task', 'stitch', 'continuity', 'artifact']);

export const linkKindSchema = z.enum([
	'relates_to',
	'supports',
	'replaced_by',
	'temporal_overlap',
	'membership'
]);

export const linkProvenanceSchema = z.enum(['observed', 'suggested', 'asserted']);

export const linkCreatorSchema = z.enum(['user', 'system', 'ai']);

export const linkStatusSchema = z.enum(['active', 'superseded', 'dismissed']);

export const linkEvidenceRefSchema = z.object({
	kind: z.enum(['trace', 'artifact', 'rule']),
	uid: uidSchema.optional(),
	note: z.string().max(500).optional()
});

export const linkSchema = z
	.object({
		uid: uidSchema,
		from_kind: linkEntityKindSchema,
		from_uid: uidSchema,
		to_kind: linkEntityKindSchema,
		to_uid: uidSchema,
		link_kind: linkKindSchema,
		provenance: linkProvenanceSchema,
		creator: linkCreatorSchema,
		evidence_refs: z.array(linkEvidenceRefSchema).default([]),
		status: linkStatusSchema,
		owner_uid: z.string().min(1),
		space_uid: z.string().min(1),
		label: z.string().max(500).nullable()
	})
	.merge(timestampsSchema);

export const createLinkSchema = z.object({
	from_kind: linkEntityKindSchema,
	from_uid: uidSchema,
	to_kind: linkEntityKindSchema,
	to_uid: uidSchema,
	link_kind: linkKindSchema.default('relates_to'),
	provenance: linkProvenanceSchema,
	creator: linkCreatorSchema,
	evidence_refs: z.array(linkEvidenceRefSchema).optional(),
	label: z.string().max(500).nullable().optional(),
	owner_uid: z.string().min(1).default('local-user'),
	space_uid: z.string().min(1).default('personal')
});

export const assertLinkSchema = z.object({
	label: z.string().max(500).nullable().optional()
});

export const dismissLinkSchema = z.object({
	reason: z.string().max(500).optional()
});

export const linkListQuerySchema = z.object({
	from_uid: uidSchema.optional(),
	to_uid: uidSchema.optional(),
	provenance: linkProvenanceSchema.optional(),
	status: linkStatusSchema.default('active'),
	link_kind: linkKindSchema.optional()
});

export type Link = z.infer<typeof linkSchema>;
export type CreateLinkInput = z.infer<typeof createLinkSchema>;
export type LinkListQuery = z.infer<typeof linkListQuerySchema>;
