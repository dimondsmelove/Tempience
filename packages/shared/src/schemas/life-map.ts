import { z } from 'zod';
import { continuitySchema, continuitySegmentSchema } from './continuity';
import { dateOnlySchema } from './space-profile';
import { periodClosureSchema } from './period-closure';
import { taskSchema } from './task';
import { taskSegmentSchema } from './task-segment';
import { uidSchema } from './common';

export const lifeWeekCellSchema = z.object({
	week_start: dateOnlySchema,
	age_in_weeks: z.number().int().min(0),
	year_index: z.number().int().min(0),
	week_index_in_year: z.number().int().min(0),
	is_current: z.boolean(),
	is_past: z.boolean(),
	is_future: z.boolean()
});

export const lifeMapProfileSchema = z.object({
	birth_date: dateOnlySchema,
	horizon_date: dateOnlySchema,
	life_horizon_years: z.number().int().min(1).max(120),
	timezone: z.string().min(1)
});

export const lifeMapRangeSchema = z.object({
	from_week_start: dateOnlySchema,
	to_week_start: dateOnlySchema
});

export const lifeMapContinuitySchema = z.object({
	continuity: continuitySchema,
	segments: z.array(continuitySegmentSchema)
});

export const lifeMapProcessSchema = z.object({
	task: taskSchema,
	segments: z.array(taskSegmentSchema),
	continuity_uids: z.array(uidSchema)
});

export const lifeMapWeekCoverageSchema = z.object({
	week_start: dateOnlySchema,
	has_traces: z.boolean()
});

export const lifeMapProjectionSchema = z.object({
	profile: lifeMapProfileSchema,
	range: lifeMapRangeSchema,
	current_week_start: dateOnlySchema,
	weeks: z.array(lifeWeekCellSchema),
	continuities: z.array(lifeMapContinuitySchema),
	processes: z.array(lifeMapProcessSchema),
	closures: z.array(periodClosureSchema),
	week_coverage: z.array(lifeMapWeekCoverageSchema)
});

export const lifeMapQuerySchema = z.object({
	from: dateOnlySchema.optional(),
	to: dateOnlySchema.optional(),
	space_uid: z.string().min(1).default('personal')
});

export type LifeWeekCell = z.infer<typeof lifeWeekCellSchema>;
export type LifeMapProfile = z.infer<typeof lifeMapProfileSchema>;
export type LifeMapProjection = z.infer<typeof lifeMapProjectionSchema>;
export type LifeMapQuery = z.infer<typeof lifeMapQuerySchema>;
