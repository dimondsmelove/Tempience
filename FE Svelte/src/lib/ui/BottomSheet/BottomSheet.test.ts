import { describe, expect, it } from 'vitest';
import { nearestPosition, sheetHeights } from './geometry';

describe('bottom sheet geometry', () => {
	it('keeps all stops reachable when the keyboard leaves little space', () => {
		for (const available of [200, 420, 760]) {
			const heights = sheetHeights(available, 24);
			expect(heights.peek).toBeLessThan(heights.half);
			expect(heights.half).toBeLessThan(heights.full);
			expect(heights.full).toBe(available);
		}
	});
	it('closes a downward dismissal and snaps intermediate drags to a reachable stop', () => {
		const heights = sheetHeights(700, 16);
		expect(nearestPosition(80, heights)).toBeNull();
		expect(nearestPosition(200, heights)).toBe('peek');
		expect(nearestPosition(400, heights)).toBe('half');
		expect(nearestPosition(680, heights)).toBe('full');
	});
	it('projects quick swipes in either direction without changing a paused drag', () => {
		const heights = sheetHeights(740, 16);
		expect(nearestPosition(480, heights, 1)).toBe('full');
		expect(nearestPosition(280, heights, -1)).toBeNull();
		expect(nearestPosition(280, heights, 0)).toBe('peek');
		expect(nearestPosition(740, heights, 20)).toBe('full');
	});
});
