import { z } from 'zod';
import { uidSchema } from './common';

export const tagSchema = z.object({
	uid: uidSchema,
	name: z.string().min(1),
	created_at: z.string().datetime()
});

export const createTagSchema = z.object({
	name: z.string().min(1).max(100)
});

export const updateTagSchema = createTagSchema;

export const setTaskTagsSchema = z.object({
	tag_uids: z.array(uidSchema)
});

export type Tag = z.infer<typeof tagSchema>;
export type CreateTagInput = z.infer<typeof createTagSchema>;
export type UpdateTagInput = z.infer<typeof updateTagSchema>;
