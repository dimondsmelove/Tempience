import { z } from 'zod';
import { uidSchema } from './common';

/** Junction trace ↔ scope. Replaces links with link_kind=membership. */
export const scopeTraceSchema = z.object({
	scope_uid: uidSchema,
	trace_uid: uidSchema,
	created_at: z.string().datetime()
});

export const attachScopeTracesSchema = z.object({
	scope_uids: z.array(uidSchema).min(1).max(20)
});

export const detachScopeTracesSchema = z.object({
	scope_uids: z.array(uidSchema).min(1).max(20)
});

export type ScopeTrace = z.infer<typeof scopeTraceSchema>;
export type AttachScopeTracesInput = z.infer<typeof attachScopeTracesSchema>;
export type DetachScopeTracesInput = z.infer<typeof detachScopeTracesSchema>;
