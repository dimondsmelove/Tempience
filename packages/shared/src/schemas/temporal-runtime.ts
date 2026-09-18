import { z } from 'zod';
import { continuityLaneSchema } from './continuity';
import { linkEvidenceRefSchema } from './link';
import { timestampsSchema, uidSchema } from './common';

export const atlasZoomSchema = z.enum(['hour', 'day', 'week', 'month', 'year']);

export const triggerKindSchema = z.enum([
	'intent_window',
	'review_window',
	'link_suggestion',
	'body_return'
]);

export const triggerProposedActionSchema = z.enum([
	'show_now_cue',
	'open_inquiry',
	'schedule_notification'
]);

export const triggerPrioritySchema = z.enum(['quiet', 'normal']);

export const triggerCandidateStatusSchema = z.enum([
	'pending',
	'eligible',
	'delivered',
	'dismissed',
	'expired'
]);

export const triggerDeliveryChannelSchema = z.enum(['in_app', 'local_notification']);

export const tracePointSummarySchema = z.object({
	uid: uidSchema,
	hook_text: z.string(),
	hook_kind: z.string(),
	relation: z.string().nullable(),
	word: z.string().nullable().optional(),
	about_at: z.string().datetime().nullable(),
	about_start: z.string().datetime().nullable(),
	about_end: z.string().datetime().nullable(),
	about_trace_uid: uidSchema.nullable().optional(),
	task_ref: z.string().nullable().optional(),
	minute_of_week: z.number().int().min(0).max(10079).nullable()
});

export const nowSliceSchema = z.object({
	anchor_at: z.string().datetime(),
	timezone: z.string().min(1),
	week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	week_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	minute_of_week: z.number().int().min(0).max(10079),
	week_progress: z.number().min(0).max(1),
	zoom: atlasZoomSchema.default('week'),
	traces: z.array(tracePointSummarySchema),
	intents_ahead: z.array(tracePointSummarySchema),
	intents_elapsed: z.array(tracePointSummarySchema),
	lanes: z.array(continuityLaneSchema).default([]),
	tick_interval_seconds: z.literal(60)
});

export const initiationPolicySchema = z.object({
	require_app_open: z.boolean(),
	max_interruptions_per_day: z.number().int().min(0),
	cooldown_per_subject_minutes: z.number().int().min(0),
	quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/),
	quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/)
});

export const triggerCandidateSchema = z
	.object({
		uid: uidSchema,
		kind: triggerKindSchema,
		subject_kind: z.enum(['trace', 'link', 'continuity', 'inquiry']),
		subject_uid: uidSchema,
		proposed_action: triggerProposedActionSchema,
		wording: z.string().max(2000).nullable(),
		evidence_refs: z.array(linkEvidenceRefSchema).default([]),
		earliest_at: z.string().datetime(),
		expires_at: z.string().datetime().nullable(),
		priority: triggerPrioritySchema,
		status: triggerCandidateStatusSchema,
		owner_uid: z.string().min(1),
		space_uid: z.string().min(1)
	})
	.merge(timestampsSchema);

export const triggerDeliverySchema = z
	.object({
		uid: uidSchema,
		candidate_uid: uidSchema,
		channel: triggerDeliveryChannelSchema,
		delivered_at: z.string().datetime(),
		dismissed_at: z.string().datetime().nullable(),
		idempotency_key: z.string().min(1)
	})
	.merge(timestampsSchema);

export const nowQuerySchema = z.object({
	at: z.string().datetime().optional(),
	timezone: z.string().min(1).default('UTC'),
	week_start: z
		.string()
		.regex(/^\d{4}-\d{2}-\d{2}$/)
		.optional(),
	evaluate: z
		.enum(['true', 'false'])
		.optional()
		.transform((v) => v === 'true')
});

export const deliverTriggerSchema = z.object({
	channel: triggerDeliveryChannelSchema.default('in_app'),
	idempotency_key: z.string().max(200).optional()
});

export const dismissTriggerSchema = z.object({
	reason: z.string().max(500).optional()
});

export type NowSlice = z.infer<typeof nowSliceSchema>;
export type InitiationPolicy = z.infer<typeof initiationPolicySchema>;
export type TriggerCandidate = z.infer<typeof triggerCandidateSchema>;
export type TriggerDelivery = z.infer<typeof triggerDeliverySchema>;
export type NowQuery = z.output<typeof nowQuerySchema>;
