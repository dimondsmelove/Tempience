import { describe, expect, it } from 'vitest';
import { canDrop } from './drag';
import type { MoveTarget } from '../MoveIntention/types';

describe('board drag targets', () => {
	it('rejects closed cards and unavailable targets but accepts the same basket', () => {
		const targets: MoveTarget[] = [
			{ kind: 'day', dayKey: '2026-09-14' },
			{ kind: 'week', weekStart: 1 },
			{ kind: 'undated' }
		];
		for (const source of targets) {
			expect(canDrop({ id: 'a', open: true, source }, source)).toBe(true);
			expect(canDrop({ id: 'a', open: false, source }, targets[0])).toBe(false);
		}
		expect(canDrop({ id: 'a', open: true }, undefined)).toBe(false);
		expect(canDrop({ id: 'a', open: true }, { kind: 'later' })).toBe(false);
		expect(canDrop({ id: 'a', open: true, source: { kind: 'later' } }, { kind: 'later' })).toBe(
			true
		);
		expect(canDrop({ id: 'a', open: true }, targets[0])).toBe(true);
		expect(
			canDrop({ id: 'a', open: true, source: targets[0] }, { kind: 'day', dayKey: '2026-09-15' })
		).toBe(true);
		expect(
			canDrop({ id: 'a', open: true, source: targets[1] }, { kind: 'week', weekStart: 2 })
		).toBe(true);
	});
});
