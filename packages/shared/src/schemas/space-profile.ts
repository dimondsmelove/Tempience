import { z } from 'zod';
import { timestampsSchema } from './common';

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const spaceProfileSchema = z
	.object({
		space_uid: z.string().min(1),
		birth_date: dateOnlySchema.nullable(),
		life_horizon_years: z.number().int().min(1).max(120),
		timezone: z.string().min(1),
		owner_uid: z.string().min(1)
	})
	.merge(timestampsSchema);

export const updateSpaceProfileSchema = z.object({
	birth_date: dateOnlySchema.nullable().optional(),
	life_horizon_years: z.number().int().min(1).max(120).optional(),
	timezone: z.string().min(1).optional(),
	space_uid: z.string().min(1).default('personal'),
	owner_uid: z.string().min(1).default('local-user')
});

export type SpaceProfile = z.infer<typeof spaceProfileSchema>;
export type UpdateSpaceProfileInput = z.infer<typeof updateSpaceProfileSchema>;
