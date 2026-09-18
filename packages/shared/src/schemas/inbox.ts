import { z } from 'zod';
import { traceSchema } from './trace';
import { linkSchema } from './link';
import { continuitySchema } from './continuity';
import { hookEnrichmentStateSchema } from './trace-enrich';

export const inboxStateFilterSchema = z.enum(['needs', 'bare', 'scoped', 'all']);

export const inboxHooksQuerySchema = z.object({
	since: z.string().datetime().optional(),
	state: inboxStateFilterSchema.default('needs'),
	limit: z.coerce.number().int().min(1).max(100).default(50)
});

export const inboxHookItemSchema = z.object({
	trace: traceSchema,
	enrichment_state: hookEnrichmentStateSchema,
	memberships: z.array(linkSchema),
	continuities: z.array(continuitySchema),
	relates_count: z.number().int().min(0),
	revisit_count: z.number().int().min(0)
});

export const inboxHooksResultSchema = z.object({
	since: z.string().datetime(),
	state: inboxStateFilterSchema,
	hooks: z.array(inboxHookItemSchema)
});

export type InboxHooksQuery = z.infer<typeof inboxHooksQuerySchema>;
export type InboxHookItem = z.infer<typeof inboxHookItemSchema>;
export type InboxHooksResult = z.infer<typeof inboxHooksResultSchema>;
