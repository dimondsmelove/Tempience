import { describe, expect, it } from 'vitest';
import { traceListQuerySchema, traceSchema } from '@chronograph/shared';

describe('trace retract schema', () => {
	it('traceSchema allows null retracted_at', () => {
		const parsed = traceSchema.parse({
			uid: '550e8400-e29b-41d4-a716-446655440000',
			captured_at: '2026-07-14T09:00:00.000Z',
			timezone: 'UTC',
			about_kind: 'instant',
			about_at: '2026-07-14T09:00:00.000Z',
			about_start: null,
			about_end: null,
			about_trace_uid: null,
			hook_text: 'test',
			hook_kind: 'pulse',
			relation: 'observe',
			valence: null,
			word: null,
			task_ref: null,
			intent_of_trace_uid: null,
			presence: null,
			idempotency_key: null,
			source: 'capture',
			retracted_at: null,
			created_at: '2026-07-14T09:00:00.000Z',
			updated_at: '2026-07-14T09:00:00.000Z'
		});
		expect(parsed.retracted_at).toBeNull();
	});

	it('traceListQuerySchema parses include_retracted=true', () => {
		const parsed = traceListQuerySchema.parse({
			week_start: '2026-07-07',
			include_retracted: 'true'
		});
		expect(parsed.include_retracted).toBe(true);
	});

	it('traceListQuerySchema defaults include_retracted to falsey', () => {
		const parsed = traceListQuerySchema.parse({ week_start: '2026-07-07' });
		expect(parsed.include_retracted).toBe(false);
	});
});

import { rescheduleTraceAboutSchema } from '@chronograph/shared';

describe('rescheduleTraceAboutSchema', () => {
	it('requires about_end after about_start', () => {
		expect(() =>
			rescheduleTraceAboutSchema.parse({
				about_start: '2026-07-14T12:00:00.000Z',
				about_end: '2026-07-14T11:00:00.000Z'
			})
		).toThrow();
	});
});
