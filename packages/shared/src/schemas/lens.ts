import { z } from 'zod';
import { uidSchema } from './common';
import {
	continuityLaneSchema,
	continuitySchema,
	continuitySegmentSchema
} from './continuity';
import { traceSchema } from './trace';

export const lensPresetSchema = z.enum([
	'atlas-week',
	'thread-recall',
	'week-traces-only',
	'orient-now'
]);

export const lensQuerySchema = z.object({
	preset: lensPresetSchema,
	timezone: z.string().min(1),
	week_start: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	continuity_uid: uidSchema.optional(),
	anchor_at: z.string().datetime().optional(),
	trace_uid: uidSchema.optional()
});

export const recallSummarySchema = z.object({
	trace_count: z.number().int().min(0),
	segment_count: z.number().int().min(0),
	continuity_name: z.string().nullable().optional()
});

export const recallSliceSchema = z.object({
	preset: z.enum(['atlas-week', 'thread-recall', 'week-traces-only']),
	timezone: z.string(),
	week_start: z.string().nullable(),
	continuity: continuitySchema.nullable().optional(),
	segments: z.array(continuitySegmentSchema).default([]),
	traces: z.array(traceSchema).default([]),
	lanes: z.array(continuityLaneSchema).default([]),
	summary: recallSummarySchema
});

export const orientContinuityCardSchema = z.object({
	continuity: continuitySchema,
	active_segment: continuitySegmentSchema.nullable(),
	linked: z.boolean(),
	pole: z.enum(['inner', 'outer'])
});

export const orientNowSummarySchema = z.object({
	linked_count: z.number().int().min(0),
	ambient_count: z.number().int().min(0),
	inner_count: z.number().int().min(0),
	outer_count: z.number().int().min(0)
});

export const orientNowSliceSchema = z.object({
	preset: z.literal('orient-now'),
	timezone: z.string(),
	anchor_at: z.string().datetime(),
	focal_trace: traceSchema.nullable(),
	cards: z.array(orientContinuityCardSchema).default([]),
	summary: orientNowSummarySchema
});

export const lensResultSchema = z.union([recallSliceSchema, orientNowSliceSchema]);

export const lensPresetInfoSchema = z.object({
	id: lensPresetSchema,
	label: z.string(),
	description: z.string(),
	requires_continuity: z.boolean()
});

export type LensPreset = z.infer<typeof lensPresetSchema>;
export type LensQuery = z.infer<typeof lensQuerySchema>;
export type RecallSlice = z.infer<typeof recallSliceSchema>;
export type OrientNowSlice = z.infer<typeof orientNowSliceSchema>;
export type LensResult = z.infer<typeof lensResultSchema>;
export type LensPresetInfo = z.infer<typeof lensPresetInfoSchema>;
