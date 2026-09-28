import { describe, expect, it } from 'vitest';
import { now, out, system, ZONE } from './Chapters.fixture';
import {
	formatDayShort,
	formatMoment,
	formatSpan,
	ms,
	msToIso,
	msToZoned,
	nextMidnight,
	zonedToMs
} from './time';

describe('time in Europe/Belgrade', () => {
	it('reads and writes the wall clock across DST', () => {
		expect(msToIso(zonedToMs('2026-09-28T00:00', ZONE)!, ZONE)).toBe('2026-09-28T00:00:00+02:00');
		expect(msToIso(zonedToMs('2026-12-01T09:30', ZONE)!, ZONE)).toBe('2026-12-01T09:30:00+01:00');
		expect(msToZoned(ms('2026-09-27T22:00:00Z'), ZONE)).toBe('2026-09-28T00:00');
		expect(zonedToMs('not a time', ZONE)).toBeNull();
	});
	it('names moments and spans the way the band and Context say them', () => {
		const today = ms('2026-09-27T12:00:00+02:00');
		expect(formatMoment(ms('2026-09-28T00:00:00+02:00'), ZONE, 'ru', today)).toBe(
			'пн, 28 сент., 00:00'
		);
		expect(formatSpan(ms(system.start), ms(system.end!), ZONE, 'ru', today)).toBe(
			'1 сент. – 28 сент.'
		);
		expect(formatSpan(ms(out.start), null, ZONE, 'ru', today)).toBe('с 28 сент.');
		expect(msToIso(nextMidnight(now, ZONE), ZONE)).toBe('2026-09-27T00:00:00+02:00');
	});
	it('says the year whenever it is not this one, in both languages', () => {
		const today = ms('2026-09-27T12:00:00+02:00');
		const old = ms('2019-10-10T00:00:00+02:00');
		const next = ms('2020-09-01T00:00:00+02:00');
		expect(formatSpan(old, next, ZONE, 'ru', today)).toBe('10 окт. 2019 – 1 сент. 2020');
		expect(formatSpan(old, next, ZONE, 'en', today)).toBe('10 Oct 2019 – 1 Sept 2020');
		expect(formatSpan(ms(out.start), null, ZONE, 'en', today)).toBe('from 28 Sept');
		expect(formatDayShort(ms('2026-05-28T12:00:00+02:00'), ZONE, 'ru', today)).toBe('28 мая');
		expect(formatMoment(old, ZONE, 'en', today)).toBe('Thu, 10 Oct 2019, 00:00');
	});
	it('takes the zone as given: the same instant reads on another wall clock elsewhere', () => {
		const at = ms('2026-09-28T00:00:00+02:00');
		expect(msToIso(at, 'UTC')).toBe('2026-09-27T22:00:00+00:00');
		expect(msToIso(nextMidnight(at, 'America/New_York'), 'America/New_York')).toBe(
			'2026-09-28T00:00:00-04:00'
		);
	});
});
