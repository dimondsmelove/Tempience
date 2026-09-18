/** @deprecated Use scope kind=continuity. SSOT: vision/core.md */
import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const areaSchema = z
	.object({
		uid: uidSchema,
		name: z.string().min(1)
	})
	.merge(timestampsSchema);

export const createAreaSchema = z.object({
	name: z.string().min(1).max(500)
});

export const updateAreaSchema = z.object({
	name: z.string().min(1).max(500)
});

export type Area = z.infer<typeof areaSchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
