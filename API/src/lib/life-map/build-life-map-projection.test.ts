import { describe, expect, it } from 'vitest';
import { instantRangeOverlaps, weekRangeUtc } from '@chronograph/shared';

describe('life-map interval helpers', () => {
	it('weekRangeUtc covers full inclusive week span', () => {
		const range = weekRangeUtc('2026-07-06', '2026-07-13');
		expect(range.from).toBe('2026-07-06T00:00:00.000Z');
		expect(range.to).toBe('2026-07-20T00:00:00.000Z');
	});

	it('instantRangeOverlaps handles open-ended intervals', () => {
		const { from, to } = weekRangeUtc('2026-07-06', '2026-07-06');
		expect(instantRangeOverlaps('2026-07-01T00:00:00.000Z', null, from, to)).toBe(true);
		expect(instantRangeOverlaps('2026-08-01T00:00:00.000Z', null, from, to)).toBe(false);
	});
});
