import { describe, expect, it } from 'vitest';
import { minuteOfWeek, weekProgress } from './week-minute';
import { isQuietHour } from './policy';
import { defaultInitiationPolicy } from './policy';

describe('week-minute', () => {
	it('maps Monday noon UTC to minute 720 in UTC zone', () => {
		const minute = minuteOfWeek('2026-07-13T12:00:00.000Z', '2026-07-13', 'UTC');
		expect(minute).toBe(720);
	});

	it('maps local wall time in Europe/Belgrade', () => {
		const minute = minuteOfWeek('2026-07-13T18:01:00.000Z', '2026-07-13', 'Europe/Belgrade');
		expect(minute).toBe(20 * 60 + 1);
	});

	it('computes week progress', () => {
		expect(weekProgress(0)).toBe(0);
		expect(weekProgress(5040)).toBe(0.5);
	});
});

describe('initiation policy', () => {
	it('detects quiet hours', () => {
		const policy = defaultInitiationPolicy();
		expect(isQuietHour('2026-07-13T23:30:00.000Z', 'UTC', policy)).toBe(true);
		expect(isQuietHour('2026-07-13T12:00:00.000Z', 'UTC', policy)).toBe(false);
	});
});
