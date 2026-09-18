import { describe, expect, it } from 'vitest';
import { lensQuerySchema, recallSliceSchema } from '@chronograph/shared';

describe('lens schema', () => {
	it('parses thread-recall query', () => {
		const parsed = lensQuerySchema.parse({
			preset: 'thread-recall',
			timezone: 'Europe/Belgrade',
			continuity_uid: '550e8400-e29b-41d4-a716-446655440000'
		});
		expect(parsed.preset).toBe('thread-recall');
	});

	it('recallSliceSchema accepts empty lanes', () => {
		const parsed = recallSliceSchema.parse({
			preset: 'thread-recall',
			timezone: 'UTC',
			week_start: null,
			segments: [],
			traces: [],
			lanes: [],
			summary: { trace_count: 0, segment_count: 0, continuity_name: 'test' }
		});
		expect(parsed.summary.trace_count).toBe(0);
	});
	it('parses orient-now query', () => {
		const parsed = lensQuerySchema.parse({
			preset: 'orient-now',
			timezone: 'Europe/Belgrade',
			anchor_at: '2026-07-14T11:30:00.000Z'
		});
		expect(parsed.preset).toBe('orient-now');
	});

});
