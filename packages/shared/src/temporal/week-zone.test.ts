import { describe, expect, it } from 'vitest';
import {
	formatFractionalMinuteInZone,
	formatMinuteInZone,
	fractionalMinuteOfWeekInZone,
	minuteOfWeekInZone,
	weekWindowForZone
} from './week-zone';

const TZ = 'Europe/Belgrade';

describe('week-zone', () => {
	it('maps UTC instant to local wall minute of week', () => {
		// 18:01 UTC = 20:01 in Belgrade (CEST, July)
		const minute = minuteOfWeekInZone('2026-07-13T18:01:00.000Z', '2026-07-13', TZ);
		expect(minute).toBe(20 * 60 + 1);
	});

	it('formats minute in timezone', () => {
		const label = formatMinuteInZone('2026-07-13', 20 * 60 + 1, TZ);
		expect(label).toMatch(/20:01/);
	});

	it('builds week window from local midnight', () => {
		const { from, to } = weekWindowForZone('2026-07-13', TZ);
		expect(from).toBe('2026-07-12T22:00:00.000Z');
		expect(to).toBe('2026-07-19T22:00:00.000Z');
	});

	it('maps fractional minute with seconds in zone', () => {
		const fraction = fractionalMinuteOfWeekInZone('2026-07-13T18:01:30.000Z', '2026-07-13', TZ);
		expect(fraction).toBeCloseTo(20 * 60 + 1.5, 5);
	});

	it('formats fractional minute with seconds', () => {
		const label = formatFractionalMinuteInZone('2026-07-13', 20 * 60 + 1.5, TZ, true);
		expect(label).toMatch(/20:01:30/);
	});
});
