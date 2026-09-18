import { describe, expect, it } from 'vitest';
import { buildContinuityLanes } from './continuity-projection';

describe('buildContinuityLanes', () => {
	it('projects segment fractions for the visible week', () => {
		const lanes = buildContinuityLanes({
			continuities: [
				{ uid: 'c1', name: 'загранпаспорт', kind: 'thread' }
			],
			segments: [
				{
					uid: 's1',
					continuityUid: 'c1',
					phase: 'active',
					startAt: '2026-07-07T10:00:00.000Z',
					endAt: null,
					label: 'оформление',
					sortOrder: 0
				}
			],
			weekStart: '2026-07-07',
			timezone: 'UTC',
			anchorAt: '2026-07-14T12:00:00.000Z'
		});

		expect(lanes).toHaveLength(1);
		expect(lanes[0].name).toBe('загранпаспорт');
		expect(lanes[0].segments[0].end_fraction).toBeGreaterThan(lanes[0].segments[0].start_fraction);
	});
});
