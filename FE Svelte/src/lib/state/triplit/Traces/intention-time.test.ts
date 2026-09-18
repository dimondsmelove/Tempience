import { describe, expect, it } from 'vitest';
import type { TraceAboutTime, TraceDuration, TraceRelation } from '../types';
import {
	plannedStartElapsed,
	samePlacement,
	validateManualIntentionTime,
	type TemporalPlacementInput
} from './intention-time';

/** 2026-09-13T10:00:30Z: half a minute into the 10:00 minute. */
const now = Date.UTC(2026, 8, 13, 10, 0, 30);

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

const elapsed = (placement: TemporalPlacementInput, at = now) => plannedStartElapsed(placement, at);
const check = (next: TemporalPlacementInput & { relation: TraceRelation | null }) =>
	validateManualIntentionTime(null, next, now);

describe('plannedStartElapsed', () => {
	it('treats an exact minute as a point that must be strictly after now', () => {
		expect(elapsed(instant(absolute('minute', '2026-09-13T10:00:00.000Z')))).toBe(true);
		expect(elapsed(instant(absolute('minute', '2026-09-13T10:00:30.000Z')))).toBe(true);
		expect(elapsed(instant(absolute('minute', '2026-09-13T10:00:31.000Z')))).toBe(false);
		expect(elapsed(instant(absolute('minute', '2026-09-13T10:01Z')))).toBe(false);
		expect(elapsed(instant(absolute('minute', '2026-09-13T12:00+02:00')))).toBe(true);
		// An approximate minute without a declared window is still a point around now.
		expect(elapsed(instant(absolute('minute', '2026-09-13T10:00Z', null, 'approximate')))).toBe(
			true
		);
	});

	it('lets a coarse unit stand as the possible start until the unit is over', () => {
		expect(elapsed(instant(absolute('day', '2026-09-12')))).toBe(true);
		expect(elapsed(instant(absolute('day', '2026-09-13')))).toBe(false);
		expect(elapsed(instant(absolute('day', '2026-09-13')), Date.UTC(2026, 8, 14))).toBe(true);
		expect(elapsed(instant(absolute('day', '2026-09-14')))).toBe(false);
		expect(elapsed(instant(absolute('month', '2026-08')))).toBe(true);
		expect(elapsed(instant(absolute('month', '2026-09')))).toBe(false);
		expect(elapsed(instant(absolute('year', '2025')))).toBe(true);
		expect(elapsed(instant(absolute('year', '2026')))).toBe(false);
	});

	it('judges the start of an interval extent, never its end', () => {
		expect(elapsed(interval(absolute('minute', '2026-09-13T09:00Z', '2026-09-13T11:00Z')))).toBe(
			true
		);
		expect(elapsed(interval(absolute('minute', '2026-09-13T10:30Z', '2026-09-13T11:00Z')))).toBe(
			false
		);
		expect(elapsed(interval(absolute('day', '2026-09-10', '2026-09-15')))).toBe(true);
		expect(elapsed(interval(absolute('day', '2026-09-13', '2026-09-15')))).toBe(false);
	});

	it('allows a start anywhere inside a declared uncertainty window', () => {
		expect(elapsed(instant(absolute('day', '2026-09-01', '2026-09-12', 'approximate')))).toBe(true);
		expect(elapsed(instant(absolute('day', '2026-09-01', '2026-09-13', 'approximate')))).toBe(
			false
		);
		const window = instant(
			absolute('minute', '2026-09-13T09:00Z', '2026-09-13T10:00Z', 'approximate')
		);
		expect(elapsed(window)).toBe(false);
		expect(elapsed(window, Date.UTC(2026, 8, 13, 10, 1))).toBe(true);
	});

	it('locates a stated-duration start without inventing a future start or end', () => {
		const days: TraceDuration = { amount: 30, unit: 'day' };
		const minutes: TraceDuration = { amount: 90, unit: 'minute' };
		expect(elapsed(interval(absolute('minute', '2026-09-13T10:00Z'), minutes))).toBe(true);
		expect(elapsed(interval(absolute('minute', '2026-09-13T10:01Z'), minutes))).toBe(false);
		expect(elapsed(interval(absolute('day', '2026-09-12'), days))).toBe(true);
		expect(elapsed(interval(absolute('day', '2026-09-13'), days))).toBe(false);
		expect(
			elapsed(interval(absolute('day', '2026-09-01', '2026-09-12', 'approximate'), days))
		).toBe(true);
		expect(
			elapsed(interval(absolute('day', '2026-09-01', '2026-09-13', 'approximate'), days))
		).toBe(false);
	});

	it('never counts unknown, relative or reference placements as elapsed', () => {
		expect(elapsed(instant({ basis: 'unknown' }))).toBe(false);
		expect(
			elapsed(
				instant({ basis: 'relative', precision: 'day', anchorTraceId: 't', relation: 'after' })
			)
		).toBe(false);
		expect(elapsed({ aboutKind: 'trace_ref', aboutTime: null })).toBe(false);
	});
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

describe('validateManualIntentionTime', () => {
	it('requires a newly assigned intention time to lie ahead and allows no time', () => {
		expect(check(instant(absolute('day', '2026-09-12')))).toEqual({ ok: false, reason: 'past' });
		expect(check(instant(absolute('day', '2026-09-13')))).toEqual({ ok: true });
		expect(check(instant(absolute('minute', '2026-09-13T10:00:00.000Z')))).toEqual({
			ok: false,
			reason: 'past'
		});
		expect(check(instant(absolute('minute', '2026-09-13T10:01Z')))).toEqual({ ok: true });
		expect(
			check(interval(absolute('minute', '2026-09-13T09:00:00.000Z', '2026-09-13T11:00:00.000Z')))
		).toEqual({ ok: false, reason: 'past' });
		expect(check(instant({ basis: 'unknown' }))).toEqual({ ok: true });
		expect(
			check(instant({ basis: 'relative', precision: 'day', anchorTraceId: 't', relation: 'after' }))
		).toEqual({ ok: true });
	});

	it('leaves facts alone', () => {
		expect(check(instant(absolute('day', '2020-01-01'), 'actual'))).toEqual({ ok: true });
		expect(check(instant(absolute('day', '2020-01-01'), null))).toEqual({ ok: true });
	});

	it('keeps an existing past time only while the final value equals the original', () => {
		const original = instant(absolute('minute', '2026-09-01T08:00:00.000Z'), 'actual');
		expect(
			validateManualIntentionTime(
				original,
				instant(absolute('minute', '2026-09-01T10:00+02:00')),
				now
			)
		).toEqual({ ok: true });
		expect(
			validateManualIntentionTime(original, instant(absolute('minute', '2026-09-01T08:01Z')), now)
		).toEqual({ ok: false, reason: 'past' });
		expect(
			validateManualIntentionTime(original, instant(absolute('day', '2026-09-01')), now)
		).toEqual({ ok: false, reason: 'past' });
		expect(validateManualIntentionTime(original, instant({ basis: 'unknown' }), now)).toEqual({
			ok: true
		});
		expect(
			validateManualIntentionTime(original, instant(absolute('day', '2026-09-20')), now)
		).toEqual({ ok: true });
		const begun = interval(absolute('minute', '2026-09-13T09:00Z', '2026-09-13T11:00Z'));
		expect(validateManualIntentionTime(begun, begun, now)).toEqual({ ok: true });
	});
});
