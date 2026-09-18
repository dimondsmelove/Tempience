/** @deprecated Use scope kind=task/project + intent-traces. SSOT: vision/core.md */
import { z } from 'zod';
import { tagSchema } from './tag';
import { timestampsSchema, uidSchema } from './common';

export const taskStatusSchema = z.enum([
	'not_started',
	'in_progress',
	'done',
	'archived',
	'waiting',
	'cancelled',
	'planned'
]);

export const taskSchema = z
	.object({
		uid: uidSchema,
		name: z.string().min(1),
		note: z.string().nullable(),
		status: taskStatusSchema,
		priority: z.number().int().min(0).max(2).nullable(),
		due_date: z.string().nullable(),
		defer_until: z.string().nullable(),
		reminder_at: z.string().nullable(),
		parent_uid: uidSchema.nullable(),
		position: z.number().int(),
		project_uid: uidSchema.nullable(),
		completed_at: z.string().nullable(),
		started_at: z.string().datetime().nullable(),
		ended_at: z.string().datetime().nullable()
	})
	.merge(timestampsSchema);

export const taskWithTagsSchema = taskSchema.extend({
	tags: z.array(tagSchema)
});

export const createTaskSchema = z.object({
	name: z.string().min(1).max(500),
	note: z.string().max(10000).nullable().optional(),
	status: taskStatusSchema.optional(),
	priority: z.number().int().min(0).max(2).nullable().optional(),
	due_date: z.string().nullable().optional(),
	defer_until: z.string().nullable().optional(),
	reminder_at: z.string().nullable().optional(),
	parent_uid: uidSchema.nullable().optional(),
	position: z.number().int().optional(),
	project_uid: uidSchema.nullable().optional(),
	started_at: z.string().datetime().nullable().optional(),
	ended_at: z.string().datetime().nullable().optional()
});

export const updateTaskSchema = createTaskSchema.partial();

export const taskListQuerySchema = z.object({
	roots: z.coerce.boolean().optional(),
	parent_uid: uidSchema.optional(),
	project_uid: uidSchema.optional(),
	status: taskStatusSchema.optional(),
	search: z.string().optional(),
	tag_uid: uidSchema.optional()
});

export type Task = z.infer<typeof taskSchema>;
export type TaskWithTags = z.infer<typeof taskWithTagsSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
