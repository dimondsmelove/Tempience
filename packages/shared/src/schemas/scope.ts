import { z } from 'zod';
import { timestampsSchema, uidSchema } from './common';

/** Target scope kinds — SSOT: vision/core.md */
export const scopeKindSchema = z.enum([
	'continuity',
	'process',
	'project',
	'task',
	'period'
]);

export const scopeStatusSchema = z.enum(['active', 'completed']);

/** Optional sub-label for continuity scopes (legacy continuity.kind) */
export const scopeFacetSchema = z.enum([
	'thread',
	'practice',
	'relationship',
	'condition'
]);

export const scopeSchema = z
	.object({
		uid: uidSchema,
		kind: scopeKindSchema,
		name: z.string().min(1).max(500),
		parent_scope_uid: uidSchema.nullable(),
		started_at: z.string().datetime().nullable(),
		ended_at: z.string().datetime().nullable(),
		note: z.string().max(5000).nullable(),
		status: scopeStatusSchema,
		superseded_by_uid: uidSchema.nullable(),
		facet: scopeFacetSchema.nullable(),
		owner_uid: z.string().min(1),
		space_uid: z.string().min(1)
	})
	.merge(timestampsSchema);

export const createScopeSchema = z.object({
	kind: scopeKindSchema,
	name: z.string().min(1).max(500),
	parent_scope_uid: uidSchema.nullable().optional(),
	started_at: z.string().datetime().nullable().optional(),
	ended_at: z.string().datetime().nullable().optional(),
	note: z.string().max(5000).nullable().optional(),
	facet: scopeFacetSchema.nullable().optional(),
	owner_uid: z.string().min(1).default('local-user'),
	space_uid: z.string().min(1).default('personal')
});

export const updateScopeSchema = z.object({
	name: z.string().min(1).max(500).optional(),
	parent_scope_uid: uidSchema.nullable().optional(),
	started_at: z.string().datetime().nullable().optional(),
	ended_at: z.string().datetime().nullable().optional(),
	note: z.string().max(5000).nullable().optional(),
	status: scopeStatusSchema.optional(),
	superseded_by_uid: uidSchema.nullable().optional(),
	facet: scopeFacetSchema.nullable().optional()
});

export const scopeListQuerySchema = z.object({
	kind: scopeKindSchema.optional(),
	parent_scope_uid: uidSchema.optional(),
	status: scopeStatusSchema.optional()
});

export type ScopeKind = z.infer<typeof scopeKindSchema>;
export type ScopeStatus = z.infer<typeof scopeStatusSchema>;
export type ScopeFacet = z.infer<typeof scopeFacetSchema>;
export type Scope = z.infer<typeof scopeSchema>;
export type CreateScopeInput = z.infer<typeof createScopeSchema>;
export type UpdateScopeInput = z.infer<typeof updateScopeSchema>;
export const scopeListResponseSchema = z.object({
	scopes: z.array(scopeSchema)
});

export type ScopeListResponse = z.infer<typeof scopeListResponseSchema>;
export type ScopeListQuery = z.infer<typeof scopeListQuerySchema>;
