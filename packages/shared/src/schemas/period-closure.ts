/** @deprecated Use scope kind=period + reflect-trace. SSOT: vision/core.md */
import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const periodKindSchema = z.enum(['week', 'month', 'year', 'decade']);

export const periodClosureSchema = z
	.object({
		uid: uidSchema,
		period_kind: periodKindSchema,
		period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		version: z.number().int().positive(),
		supersedes_uid: uidSchema.nullable(),
		summary: z.string().nullable(),
		trace_uids: z.array(uidSchema),
		stitch_uids: z.array(uidSchema),
		child_closure_uids: z.array(uidSchema)
	})
	.merge(timestampsSchema);

export const createPeriodClosureSchema = z.object({
	period_kind: periodKindSchema.default('week'),
	period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	summary: z.string().max(5000).nullable().optional(),
	trace_uids: z.array(uidSchema).default([]),
	stitch_uids: z.array(uidSchema).default([]),
	child_closure_uids: z.array(uidSchema).default([])
});

export const periodClosureListQuerySchema = z.object({
	period_kind: periodKindSchema.optional(),
	limit: z.coerce.number().int().min(1).max(100).optional()
});

export type PeriodClosure = z.infer<typeof periodClosureSchema>;
export type CreatePeriodClosureInput = z.infer<typeof createPeriodClosureSchema>;
export type PeriodKind = z.infer<typeof periodKindSchema>;
