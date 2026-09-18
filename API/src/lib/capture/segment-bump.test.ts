import { describe, expect, it } from 'vitest';
import { bumpContinuitySegment } from './segment-bump';

describe('bumpContinuitySegment', () => {
	it('closes open segment and appends a new active segment', () => {
		const updates: Array<{ uid: string; endAt: string }> = [];
		const inserted: Array<{ uid: string; label: string | null; sortOrder: number }> = [];

		const result = bumpContinuitySegment({
			continuityUid: 'c-move',
			at: '2026-07-14T11:30:00.000Z',
			label: 'направление внимания',
			phase: 'active',
			existingSegments: [
				{
					uid: 's1',
					continuityUid: 'c-move',
					phase: 'active',
					startAt: '2026-06-01T00:00:00.000Z',
					endAt: null,
					label: 'размышления',
					sortOrder: 0,
					createdAt: '2026-06-01T00:00:00.000Z'
				}
			],
			newUid: () => 's2',
			updateSegmentEnd: (uid, endAt) => {
				updates.push({ uid, endAt });
			},
			insertSegment: (row) => {
				inserted.push({ uid: row.uid, label: row.label, sortOrder: row.sortOrder });
			}
		});

		expect(updates).toEqual([{ uid: 's1', endAt: '2026-07-14T11:30:00.000Z' }]);
		expect(inserted).toHaveLength(1);
		expect(inserted[0]?.label).toBe('направление внимания');
		expect(result.uid).toBe('s2');
	});
});
