import { z } from 'zod';
import { uidSchema } from './common';
import { hookEnrichmentStateSchema } from './trace-enrich';
import { scopeKindSchema } from './scope';
import { traceSchema } from './trace';

export const dayContextQuerySchema = z.object({
	timezone: z.string().min(1).default('Europe/Moscow')
});

export const dayScopeTouchSchema = z.object({
	kind: scopeKindSchema,
	uid: uidSchema,
	name: z.string(),
	trace_count: z.number().int().min(0)
});

export const dayEnrichmentSummarySchema = z.object({
	bare: z.number().int().min(0),
	scoped: z.number().int().min(0),
	woven: z.number().int().min(0),
	interpreted: z.number().int().min(0)
});

export const dayContextSchema = z.object({
	date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	timezone: z.string(),
	traces: z.array(traceSchema).default([]),
	scope_touches: z.array(dayScopeTouchSchema).default([]),
	enrichment_summary: dayEnrichmentSummarySchema
});

export type DayContextQuery = z.infer<typeof dayContextQuerySchema>;
export type DayScopeTouch = z.infer<typeof dayScopeTouchSchema>;
export type DayContext = z.infer<typeof dayContextSchema>;
