import { z } from 'zod';
import { uidSchema } from './common';
import { scopeKindSchema } from './scope';
import { continuitySegmentSchema } from './continuity';
import { periodClosureSchema } from './period-closure';
import { taskSchema } from './task';
import { taskSegmentSchema } from './task-segment';
import { traceSchema } from './trace';

export const scopeLensSchema = z.enum([
	'scope-card',
	'atlas-week',
	'ledger-week',
	'thread-recall',
	'orient-now',
	'life-strip'
]);

export const scopeContextQuerySchema = z.object({
	view_time: z.string().datetime().optional(),
	lens: scopeLensSchema.default('scope-card'),
	trace_limit: z.coerce.number().int().min(1).max(200).default(50)
});

export const scopeEntitySchema = z.object({
	uid: uidSchema,
	kind: scopeKindSchema,
	name: z.string(),
	status: z.string(),
	started_at: z.string().datetime().nullable(),
	ended_at: z.string().datetime().nullable(),
	note: z.string().nullable().optional()
});

export const scopePhaseSchema = z.union([continuitySegmentSchema, taskSegmentSchema]);

export const scopeLinkedScopeSchema = z.object({
	uid: uidSchema,
	kind: scopeKindSchema,
	name: z.string(),
	link_label: z.string().nullable().optional()
});

export const scopeTraceAttachmentSchema = z.enum([
	'membership',
	'task_ref',
	'membership_via_task'
]);

export const scopeTraceItemSchema = z.object({
	trace: traceSchema,
	attachment: scopeTraceAttachmentSchema,
	via_task_uid: uidSchema.nullable().optional()
});

export const scopeProjectionMetaSchema = z.object({
	view_time: z.string().datetime(),
	lens: scopeLensSchema,
	trace_count: z.number().int().min(0),
	dedupe_applied: z.literal(true)
});

export const scopeContextSchema = z.object({
	scope: scopeEntitySchema,
	phases: z.array(scopePhaseSchema).default([]),
	commitments: z.array(taskSchema).default([]),
	linked_scopes: z.array(scopeLinkedScopeSchema).default([]),
	traces: z.array(scopeTraceItemSchema).default([]),
	closures: z.array(periodClosureSchema).default([]),
	projection_meta: scopeProjectionMetaSchema
});

export type ScopeTraceAttachment = z.infer<typeof scopeTraceAttachmentSchema>;
export type ScopeLens = z.infer<typeof scopeLensSchema>;
export type ScopeContextQuery = z.infer<typeof scopeContextQuerySchema>;
export type ScopeEntity = z.infer<typeof scopeEntitySchema>;
export type ScopeLinkedScope = z.infer<typeof scopeLinkedScopeSchema>;
export type ScopeTraceItem = z.infer<typeof scopeTraceItemSchema>;
export type ScopeContext = z.infer<typeof scopeContextSchema>;
