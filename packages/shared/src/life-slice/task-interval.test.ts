import { describe, expect, it } from 'vitest';
import { segmentWithinTask } from './task-interval';

describe('segmentWithinTask', () => {
	it('accepts segment inside process window', () => {
		expect(
			segmentWithinTask(
				{
					started_at: '2024-03-01T12:00:00.000Z',
					ended_at: '2024-08-31T12:00:00.000Z'
				},
				{ start_at: '2024-04-01T12:00:00.000Z', end_at: '2024-04-30T12:00:00.000Z' }
			)
		).toBe(true);
	});

	it('rejects segment before process start', () => {
		expect(
			segmentWithinTask(
				{ started_at: '2024-03-01T12:00:00.000Z', ended_at: null },
				{ start_at: '2024-01-01T12:00:00.000Z', end_at: null }
			)
		).toBe(false);
	});
});
