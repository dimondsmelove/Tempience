import { z } from 'zod';
import { uidSchema } from './common';
import {
	continuityKindSchema,
	continuitySchema,
	continuitySegmentSchema
} from './continuity';
import { scopeKindSchema } from './scope';
import { linkSchema } from './link';
import { createTraceSchema, traceSchema } from './trace';

export const captureScopeRefSchema = z.discriminatedUnion('mode', [
	z.object({
		mode: z.literal('existing'),
		continuity_uid: uidSchema
	}),
	z.object({
		mode: z.literal('create'),
		name: z.string().min(1).max(500),
		kind: continuityKindSchema.default('thread'),
		initial_segment_label: z.string().max(500).nullable().optional()
	})
]);

/** @deprecated use captureScopeRefSchema */
export const captureContinuityRefSchema = captureScopeRefSchema;

export const captureSegmentBumpSchema = z.object({
	continuity_uid: uidSchema,
	label: z.string().max(500).optional()
});

const captureMomentBaseSchema = z.object({
	idempotency_key: z.string().min(1).max(200),
	trace: createTraceSchema.omit({ idempotency_key: true }),
	scopes: z.array(captureScopeRefSchema).max(6).default([]),
	segment_bumps: z.array(captureSegmentBumpSchema).max(3).optional()
});

export const captureMomentSchema = z.preprocess((raw) => {
	if (!raw || typeof raw !== 'object') return raw;
	const input = raw as Record<string, unknown>;
	if (input.scopes === undefined && input.threads !== undefined) {
		return { ...input, scopes: input.threads };
	}
	return input;
}, captureMomentBaseSchema);

export const captureMomentResultSchema = z.object({
	trace: traceSchema,
	memberships: z.array(linkSchema),
	continuities: z.array(continuitySchema),
	segments: z.array(continuitySegmentSchema)
});

export type CaptureScopeRef = z.infer<typeof captureScopeRefSchema>;
/** @deprecated */
export type CaptureContinuityRef = CaptureScopeRef;
export type CaptureSegmentBump = z.infer<typeof captureSegmentBumpSchema>;
export type CaptureMomentInput = z.infer<typeof captureMomentBaseSchema>;
export type CaptureMomentResult = z.infer<typeof captureMomentResultSchema>;

/** Target capture scope ref (F1+). Today API still uses continuity_uid — see captureScopeRefSchema. */
export const captureScopeRefTargetSchema = z.discriminatedUnion('mode', [
	z.object({
		mode: z.literal('existing'),
		scope_uid: uidSchema
	}),
	z.object({
		mode: z.literal('create'),
		name: z.string().min(1).max(500),
		kind: scopeKindSchema,
		parent_scope_uid: uidSchema.optional(),
		initial_segment_label: z.string().max(500).nullable().optional()
	})
]);

export type CaptureScopeRefTarget = z.infer<typeof captureScopeRefTargetSchema>;
