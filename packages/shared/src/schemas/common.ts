import { z } from 'zod';

export const uidSchema = z.string().uuid();

export const timestampsSchema = z.object({
	created_at: z.string().datetime(),
	updated_at: z.string().datetime()
});

export const apiErrorSchema = z.object({
	error: z.string(),
	details: z.unknown().optional()
});
