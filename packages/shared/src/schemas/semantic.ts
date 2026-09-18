import { z } from 'zod';
import { uidSchema } from './common';
import { lensPresetSchema } from './lens';

export const semanticDimensionSchema = z.enum([
	'essence',
	'meaning',
	'role',
	'inner',
	'place',
	'figures',
	'tension',
	'direction',
	'rhythm',
	'metaphor',
	'free'
]);

export const semanticTagSourceSchema = z.enum(['template', 'free', 'suggested']);

export const continuitySemanticTagSchema = z.object({
	uid: uidSchema,
	continuity_uid: uidSchema,
	tag: z.string().min(1).max(100),
	dimension: semanticDimensionSchema,
	source: semanticTagSourceSchema,
	created_at: z.string().datetime()
});

export const semanticTagInputSchema = z.object({
	tag: z.string().min(1).max(100),
	dimension: semanticDimensionSchema,
	source: semanticTagSourceSchema.default('free')
});

export const upsertSemanticTagsSchema = z.object({
	tags: z.array(semanticTagInputSchema).max(30)
});

export const lexicalSearchQuerySchema = z.object({
	q: z.string().min(1).max(200),
	limit: z.number().int().min(1).max(50).default(20)
});

export const searchHitKindSchema = z.enum([
	'continuity',
	'trace',
	'intersection',
	'lexeme_cluster'
]);

export const searchWhySchema = z.object({
	signal: z.string(),
	weight: z.number(),
	detail: z.string().optional()
});

export const searchRouteSchema = z.object({
	lens_preset: lensPresetSchema.optional(),
	continuity_uid: uidSchema.optional(),
	trace_uid: uidSchema.optional()
});

export const searchHitSchema = z.object({
	kind: searchHitKindSchema,
	uid: z.string(),
	title: z.string(),
	subtitle: z.string().optional(),
	continuity_uid: uidSchema.optional(),
	route: searchRouteSchema,
	why: z.array(searchWhySchema),
	score: z.number()
});

export const searchClusterSchema = z.object({
	continuity_uid: uidSchema.nullable(),
	continuity_name: z.string().nullable(),
	hits: z.array(searchHitSchema)
});

export const lexemeBridgeSchema = z.object({
	lexeme: z.string(),
	continuity_uids: z.array(uidSchema),
	kind: z.enum(['homonym', 'resonant', 'confirmed']),
	intersection_count: z.number().int().min(0)
});

export const lexicalSearchResultSchema = z.object({
	query: z.string(),
	clusters: z.array(searchClusterSchema),
	bridges: z.array(lexemeBridgeSchema),
	rag_enabled: z.boolean().default(false)
});

export const SEMANTIC_TEMPLATE_QUESTIONS = [
	{ dimension: 'essence', question: 'Как ты называешь эту нить одним-двумя словами?' },
	{ dimension: 'meaning', question: 'Что это для тебя, если убрать детали?' },
	{ dimension: 'role', question: 'Какую роль она играет в жизни сейчас?' },
	{ dimension: 'inner', question: 'Какими словами это чувствуется в теле/состоянии?' },
	{ dimension: 'place', question: 'Где это живёт — место, быт, среда?' },
	{ dimension: 'figures', question: 'Кто здесь главные фигуры?' },
	{ dimension: 'tension', question: 'Что здесь болит, тревожит, сопротивляется?' },
	{ dimension: 'direction', question: 'К чему эта нить ведёт или что обещает?' },
	{ dimension: 'rhythm', question: 'Какой у неё ритм — ежедневно, волнами, сезонно?' },
	{ dimension: 'metaphor', question: 'Какой образ или метафора ей подходит?' }
] as const;

export type SemanticDimension = z.infer<typeof semanticDimensionSchema>;
export type SemanticTagInput = z.infer<typeof semanticTagInputSchema>;
export type ContinuitySemanticTag = z.infer<typeof continuitySemanticTagSchema>;
export type SearchHit = z.infer<typeof searchHitSchema>;
export type LexemeBridge = z.infer<typeof lexemeBridgeSchema>;
export type LexicalSearchResult = z.infer<typeof lexicalSearchResultSchema>;
