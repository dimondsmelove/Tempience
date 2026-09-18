import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const continuityKindSchema = z.enum(['thread', 'practice', 'relationship', 'condition']);

export const continuityStatusSchema = z.enum(['active', 'dormant', 'completed']);

export const continuityPhaseSchema = z.enum(['active', 'dormant', 'punctured']);

export const continuitySegmentSchema = z.object({
	uid: uidSchema,
	continuity_uid: uidSchema,
	phase: continuityPhaseSchema,
	start_at: z.string().datetime().nullable(),
	end_at: z.string().datetime().nullable(),
	label: z.string().max(500).nullable(),
	sort_order: z.number().int().min(0),
	created_at: z.string().datetime()
});

export const continuitySchema = z
	.object({
		uid: uidSchema,
		name: z.string().min(1).max(500),
		kind: continuityKindSchema,
		status: continuityStatusSchema,
		started_at: z.string().datetime().nullable(),
		ended_at: z.string().datetime().nullable(),
		owner_uid: z.string().min(1),
		space_uid: z.string().min(1)
	})
	.merge(timestampsSchema);

export const createContinuitySchema = z.object({
	name: z.string().min(1).max(500),
	kind: continuityKindSchema.default('thread'),
	started_at: z.string().datetime().optional(),
	initial_segment_label: z.string().max(500).nullable().optional(),
	owner_uid: z.string().min(1).default('local-user'),
	space_uid: z.string().min(1).default('personal')
});

export const updateContinuitySchema = z.object({
	name: z.string().min(1).max(500).optional(),
	kind: continuityKindSchema.optional(),
	status: continuityStatusSchema.optional(),
	started_at: z.string().datetime().nullable().optional(),
	ended_at: z.string().datetime().nullable().optional()
});

export const createContinuitySegmentSchema = z.object({
	phase: continuityPhaseSchema.default('active'),
	start_at: z.string().datetime().optional(),
	end_at: z.string().datetime().nullable().optional(),
	label: z.string().max(500).nullable().optional()
});

export const continuityLaneSegmentSchema = z.object({
	uid: uidSchema,
	phase: continuityPhaseSchema,
	start_fraction: z.number().min(0).max(10080),
	end_fraction: z.number().min(0).max(10080),
	label: z.string().nullable()
});

export const continuityLaneSchema = z.object({
	uid: uidSchema,
	name: z.string(),
	kind: continuityKindSchema,
	row: z.number().int().min(0),
	segments: z.array(continuityLaneSegmentSchema)
});

export type ContinuityPhase = z.infer<typeof continuityPhaseSchema>;
export type Continuity = z.infer<typeof continuitySchema>;
export type ContinuitySegment = z.infer<typeof continuitySegmentSchema>;
export type CreateContinuityInput = z.infer<typeof createContinuitySchema>;
export type UpdateContinuityInput = z.infer<typeof updateContinuitySchema>;
export type CreateContinuitySegmentInput = z.infer<typeof createContinuitySegmentSchema>;
export type ContinuityLane = z.infer<typeof continuityLaneSchema>;

export const fieldUpdateSchema = z.object({
	at: z.string().datetime().optional(),
	label: z.string().min(1).max(500),
	phase: continuityPhaseSchema.default('active')
});

export type FieldUpdateInput = z.infer<typeof fieldUpdateSchema>;

