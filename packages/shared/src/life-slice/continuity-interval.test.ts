import { describe, expect, it } from 'vitest';
import {
	continuityIntervalValid,
	segmentIntervalValid,
	segmentWithinContinuity
} from './continuity-interval';

describe('continuity interval', () => {
	it('accepts open-ended continuity', () => {
		expect(
			continuityIntervalValid({ started_at: '2022-01-01T00:00:00.000Z', ended_at: null })
		).toBe(true);
	});

	it('rejects ended before started', () => {
		expect(
			continuityIntervalValid({
				started_at: '2024-01-01T00:00:00.000Z',
				ended_at: '2023-01-01T00:00:00.000Z'
			})
		).toBe(false);
	});

	it('accepts segment inside continuity window', () => {
		expect(
			segmentWithinContinuity(
				{ started_at: '2022-01-01T00:00:00.000Z', ended_at: null },
				{ start_at: '2023-03-01T12:00:00.000Z', end_at: '2023-04-15T12:00:00.000Z' }
			)
		).toBe(true);
	});

	it('rejects segment before continuity start', () => {
		expect(
			segmentWithinContinuity(
				{ started_at: '2022-01-01T00:00:00.000Z', ended_at: null },
				{ start_at: '2021-03-01T12:00:00.000Z', end_at: null }
			)
		).toBe(false);
	});

	it('rejects segment ending after continuity end', () => {
		expect(
			segmentWithinContinuity(
				{ started_at: '2022-01-01T00:00:00.000Z', ended_at: '2024-12-31T00:00:00.000Z' },
				{ start_at: '2024-06-01T00:00:00.000Z', end_at: '2025-01-01T00:00:00.000Z' }
			)
		).toBe(false);
	});

	it('rejects inverted segment interval', () => {
		expect(
			segmentIntervalValid({
				start_at: '2024-06-01T00:00:00.000Z',
				end_at: '2024-01-01T00:00:00.000Z'
			})
		).toBe(false);
	});
});
