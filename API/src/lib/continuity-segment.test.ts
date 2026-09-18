import { describe, expect, it } from 'vitest';
import { createContinuitySegmentSchema } from '@chronograph/shared';

describe('continuity segment schema', () => {
	it('accepts retro segment with day-level iso', () => {
		const parsed = createContinuitySegmentSchema.parse({
			phase: 'dormant',
			start_at: '2026-03-01T12:00:00.000Z',
			end_at: '2026-04-15T12:00:00.000Z',
			label: 'обдумывание'
		});
		expect(parsed.phase).toBe('dormant');
		expect(parsed.label).toBe('обдумывание');
	});

	it('defaults phase to active', () => {
		const parsed = createContinuitySegmentSchema.parse({ label: 'start' });
		expect(parsed.phase).toBe('active');
	});
});
