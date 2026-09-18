/** @deprecated Use scope membership. Table removed F5. SSOT: vision/core.md */
import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const stitchSchema = z
	.object({
		uid: uidSchema,
		label: z.string().nullable(),
		trace_uids: z.array(uidSchema).min(2),
		superseded_at: z.string().datetime().nullable()
	})
	.merge(timestampsSchema);

export const createStitchSchema = z.object({
	label: z.string().max(500).nullable().optional(),
	trace_uids: z.array(uidSchema).min(2).max(50)
});

export type Stitch = z.infer<typeof stitchSchema>;
export type CreateStitchInput = z.infer<typeof createStitchSchema>;
