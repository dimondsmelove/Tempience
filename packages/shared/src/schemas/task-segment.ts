import { z } from 'zod';
import { continuityPhaseSchema } from './continuity';
import { uidSchema } from './common';

export const taskSegmentSchema = z.object({
	uid: uidSchema,
	task_uid: uidSchema,
	phase: continuityPhaseSchema,
	start_at: z.string().datetime().nullable(),
	end_at: z.string().datetime().nullable(),
	label: z.string().max(500).nullable(),
	sort_order: z.number().int().min(0),
	created_at: z.string().datetime()
});

export const createTaskSegmentSchema = z.object({
	phase: continuityPhaseSchema.default('active'),
	start_at: z.string().datetime().optional(),
	end_at: z.string().datetime().nullable().optional(),
	label: z.string().max(500).nullable().optional()
});

export type TaskSegment = z.infer<typeof taskSegmentSchema>;
export type CreateTaskSegmentInput = z.infer<typeof createTaskSegmentSchema>;
