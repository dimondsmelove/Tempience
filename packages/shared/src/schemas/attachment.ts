import { z } from 'zod';
import { uidSchema } from './common';

export const taskAttachmentSchema = z.object({
	uid: uidSchema,
	task_uid: uidSchema,
	filename: z.string().min(1),
	mime_type: z.string().min(1),
	size_bytes: z.number().int().nonnegative(),
	created_at: z.string()
});

export const moveTaskSchema = z.object({
	direction: z.enum(['up', 'down'])
});

export type TaskAttachment = z.infer<typeof taskAttachmentSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
