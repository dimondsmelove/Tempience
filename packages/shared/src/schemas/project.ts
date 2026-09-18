/** @deprecated Use scope kind=project. SSOT: vision/core.md */
import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const projectStatusSchema = z.enum([
	'not_started',
	'planned',
	'in_progress',
	'waiting',
	'done',
	'cancelled'
]);

export const projectSchema = z
	.object({
		uid: uidSchema,
		name: z.string().min(1),
		description: z.string().nullable(),
		area_uid: uidSchema.nullable(),
		status: projectStatusSchema,
		due_date: z.string().nullable()
	})
	.merge(timestampsSchema);

export const createProjectSchema = z.object({
	name: z.string().min(1).max(500),
	description: z.string().max(5000).nullable().optional(),
	area_uid: uidSchema.nullable().optional(),
	status: projectStatusSchema.optional(),
	due_date: z.string().nullable().optional()
});

export const updateProjectSchema = createProjectSchema.partial();

export type Project = z.infer<typeof projectSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
