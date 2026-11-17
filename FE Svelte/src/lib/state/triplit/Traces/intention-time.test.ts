import { describe, expect, it } from 'vitest';
import type { TraceAboutTime, TraceDuration, TraceRelation } from '../types';
import { samePlacement, type TemporalPlacementInput } from './intention-time';

const absolute = (
	precision: 'minute' | 'day' | 'month' | 'season' | 'year',
	start: string,
	end: string | null = null,
	certainty: 'exact' | 'approximate' = 'exact'
): TraceAboutTime => ({ basis: 'absolute', precision, certainty, start, end });

const instant = (
	aboutTime: TraceAboutTime | null,
	relation: TraceRelation | null = 'intend'
): TemporalPlacementInput & { relation: TraceRelation | null } => ({
	aboutKind: 'instant',
	aboutTime,
	relation
});

const interval = (
	aboutTime: TraceAboutTime,
	statedDuration: TraceDuration | null = null
): TemporalPlacementInput & { relation: TraceRelation | null } => ({
	aboutKind: 'interval',
	aboutTime,
	statedDuration,
	relation: 'intend'
});

describe('samePlacement', () => {
	it('compares times as calendar values, not spellings', () => {
		expect(
			samePlacement(
				instant(absolute('minute', '2026-09-01T08:00:00.000Z')),
				instant(absolute('minute', '2026-09-01T10:00+02:00'))
			)
		).toBe(true);
		expect(
			samePlacement(instant(absolute('day', '2026-09-01')), instant(absolute('day', '2026-09-02')))
		).toBe(false);
		expect(
			samePlacement(
				instant(absolute('day', '2026-09-01')),
				instant(absolute('minute', '2026-09-01T00:00Z'))
			)
		).toBe(false);
		expect(
			samePlacement(
				instant(absolute('day', '2026-09-01')),
				instant(absolute('day', '2026-09-01', null, 'approximate'))
			)
		).toBe(false);
		expect(samePlacement(instant({ basis: 'unknown' }), instant({ basis: 'unknown' }))).toBe(true);
		expect(samePlacement(instant({ basis: 'unknown' }), instant(null))).toBe(false);
	});

	it('distinguishes kinds, stated durations and relative anchors', () => {
		const time = absolute('day', '2026-09-01');
		expect(samePlacement(instant(time), interval(time))).toBe(false);
		expect(samePlacement(interval(time), interval(time, { amount: 2, unit: 'day' }))).toBe(false);
		expect(
			samePlacement(
				interval(time, { amount: 2, unit: 'day' }),
				interval(time, { amount: 2, unit: 'day' })
			)
		).toBe(true);
		const relative = (anchorTraceId: string): TraceAboutTime => ({
			basis: 'relative',
			precision: 'day',
			anchorTraceId,
			relation: 'after'
		});
		expect(samePlacement(instant(relative('a')), instant(relative('a')))).toBe(true);
		expect(samePlacement(instant(relative('a')), instant(relative('b')))).toBe(false);
	});
});
