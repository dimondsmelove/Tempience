import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

export const traceRelationSchema = z.enum([
	'intend',
	'observe',
	'remember',
	'imagine',
	'revisit'
]);

export const traceHookKindSchema = z.enum([
	'pulse',
	'photo',
	'intent',
	'voice',
	'completion',
	'revisit',
	'observe'
]);

export const tracePresenceSchema = z.enum(['intended', 'other', 'partial']);

export const traceAboutKindSchema = z.enum(['instant', 'interval', 'trace_ref']);

export const traceSchema = z
	.object({
		uid: uidSchema,
		captured_at: z.string().datetime(),
		timezone: z.string().min(1),
		about_kind: traceAboutKindSchema,
		about_at: z.string().datetime().nullable(),
		about_start: z.string().datetime().nullable(),
		about_end: z.string().datetime().nullable(),
		about_trace_uid: uidSchema.nullable(),
		hook_text: z.string().min(1),
		hook_kind: traceHookKindSchema,
		relation: traceRelationSchema.nullable(),
		valence: z.number().int().min(-4).max(4).nullable(),
		word: z.string().nullable(),
		task_ref: z.string().nullable(),
		intent_of_trace_uid: uidSchema.nullable(),
		presence: tracePresenceSchema.nullable(),
		idempotency_key: z.string().nullable(),
		source: z.string().default('capture'),
		retracted_at: z.string().datetime().nullable()
	})
	.merge(timestampsSchema);

export const createTraceSchema = z.object({
	captured_at: z.string().datetime().optional(),
	timezone: z.string().min(1),
	about_kind: traceAboutKindSchema,
	about_at: z.string().datetime().optional(),
	about_start: z.string().datetime().optional(),
	about_end: z.string().datetime().optional(),
	about_trace_uid: uidSchema.optional(),
	hook_text: z.string().min(1).max(5000),
	hook_kind: traceHookKindSchema.default('pulse'),
	relation: traceRelationSchema.optional(),
	valence: z.number().int().min(-4).max(4).nullable().optional(),
	word: z.string().max(200).nullable().optional(),
	task_ref: z.string().max(200).nullable().optional(),
	intent_of_trace_uid: uidSchema.nullable().optional(),
	presence: tracePresenceSchema.nullable().optional(),
	idempotency_key: z.string().max(200).optional()
});

export const traceListQuerySchema = z.object({
	week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	include_retracted: z
		.union([z.literal('true'), z.literal('false'), z.boolean()])
		.optional()
		.transform((value) => value === true || value === 'true')
		.default(false)
});

export type Trace = z.infer<typeof traceSchema>;
export type CreateTraceInput = z.infer<typeof createTraceSchema>;

export const rescheduleTraceAboutSchema = z
	.object({
		about_start: z.string().datetime(),
		about_end: z.string().datetime()
	})
	.refine(
		(value) => new Date(value.about_end).getTime() > new Date(value.about_start).getTime(),
		{ message: 'about_end must be after about_start' }
	);

export type RescheduleTraceAboutInput = z.infer<typeof rescheduleTraceAboutSchema>;

export type TraceListQuery = z.infer<typeof traceListQuerySchema>;
