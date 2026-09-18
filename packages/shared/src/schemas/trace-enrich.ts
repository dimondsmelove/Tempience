import { z } from 'zod';
import { uidSchema } from './common';
import { captureContinuityRefSchema } from './capture';
import { linkSchema } from './link';
import { continuitySchema, continuitySegmentSchema } from './continuity';

export const hookEnrichmentStateSchema = z.enum([
	'bare',
	'scoped',
	'woven',
	'interpreted'
]);

export const traceMembershipsInputSchema = z.object({
	refs: z.array(captureContinuityRefSchema).min(1).max(6),
	primary_continuity_uid: uidSchema.optional()
});

export const traceRelatesInputSchema = z.object({
	to_kind: z.enum(['trace', 'task']),
	to_uid: uidSchema,
	label: z.string().max(500).nullable().optional()
});

export const traceMembershipsResultSchema = z.object({
	trace_uid: uidSchema,
	memberships: z.array(linkSchema),
	continuities: z.array(continuitySchema),
	segments: z.array(continuitySegmentSchema)
});

export const traceRelatesResultSchema = z.object({
	link: linkSchema
});

export type TraceMembershipsInput = z.infer<typeof traceMembershipsInputSchema>;
export type TraceRelatesInput = z.infer<typeof traceRelatesInputSchema>;
