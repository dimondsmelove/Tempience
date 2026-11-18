import { describe, expect, it } from 'vitest';
import { planWhen, whenView } from './WhenModel';
import type { WhenContext, WhenTrace } from './types';

const zone = 'Europe/Belgrade';
const context: WhenContext = {
	zone,
	now: Date.parse('2026-11-30T22:59:00Z'),
	weekStart: Date.parse('2026-09-13T22:00:00Z')
};
const trace = (
	aboutTime: WhenTrace['aboutTime'],
	statedDuration: WhenTrace['statedDuration'] = null,
	aboutKind: WhenTrace['aboutKind'] = 'instant'
): WhenTrace => ({ aboutKind, aboutTime, statedDuration });
const minute = (
	start: string,
	end: string | null = null,
	certainty: 'exact' | 'approximate' = 'exact'
) => ({ basis: 'absolute' as const, precision: 'minute' as const, certainty, start, end });
const day = (
	start: string,
	certainty: 'exact' | 'approximate' = 'exact',
	end: string | null = null
) => ({ basis: 'absolute' as const, precision: 'day' as const, certainty, start, end });

describe('planWhen', () => {
	it('resolves today and tomorrow by local date across month and year boundaries', () => {
		expect(planWhen(trace({ basis: 'unknown' }), { kind: 'today' }, context)).toMatchObject({
			fields: { aboutTime: { start: '2026-11-30' } }
		});
		expect(planWhen(trace({ basis: 'unknown' }), { kind: 'tomorrow' }, context)).toMatchObject({
			fields: { aboutTime: { start: '2026-12-01' } }
		});
		const afterMidnight = { ...context, now: Date.parse('2026-11-30T23:01:00Z') };
		expect(planWhen(trace({ basis: 'unknown' }), { kind: 'today' }, afterMidnight)).toMatchObject({
			fields: { aboutTime: { start: '2026-12-01' } }
		});
		const midnight = { ...context, now: Date.parse('2026-12-31T22:59:00Z') };
		expect(planWhen(trace({ basis: 'unknown' }), { kind: 'tomorrow' }, midnight)).toMatchObject({
			fields: { aboutTime: { start: '2027-01-01' } }
		});
	});
	it('uses the opened week and clears clock time for week and undated', () => {
		expect(
			planWhen(trace(minute('2026-12-01T10:00:00+01:00')), { kind: 'week' }, context)
		).toMatchObject({ fields: { aboutTime: { start: '2026-09-14', end: '2026-09-20' } } });
		expect(
			planWhen(trace(minute('2026-12-01T10:00:00+01:00')), { kind: 'undated' }, context)
		).toMatchObject({ fields: { aboutTime: { basis: 'unknown' } } });
	});
	it('preserves time, certainty, explicit wall duration, and stated duration', () => {
		expect(
			planWhen(
				trace(minute('2026-12-01T15:00:00+01:00', null, 'approximate')),
				{ kind: 'day', dayKey: '2026-12-02' },
				context
			)
		).toMatchObject({
			fields: { aboutTime: { start: '2026-12-02T15:00:00+01:00', certainty: 'approximate' } }
		});
		const weekRange = trace(day('2026-09-14', 'exact', '2026-09-20'), null, 'interval');
		expect(planWhen(weekRange, { kind: 'time', hours: 10, minutes: 30 }, context)).toEqual({
			ok: false,
			reason: 'needs_day'
		});
		expect(
			planWhen(
				trace(minute('2026-12-01T10:00:00+01:00', '2026-12-01T11:00:00+01:00')),
				{ kind: 'day', dayKey: '2026-12-02' },
				context
			)
		).toMatchObject({
			fields: {
				aboutTime: { start: '2026-12-02T10:00:00+01:00', end: '2026-12-02T11:00:00+01:00' }
			}
		});
		const duration = { amount: 90, unit: 'minute' as const };
		expect(
			planWhen(
				{ ...trace(day('2026-12-01'), duration), aboutKind: 'instant' },
				{ kind: 'day', dayKey: '2026-12-02' },
				context
			)
		).toMatchObject({ fields: { aboutKind: 'interval', statedDuration: duration } });
		expect(
			planWhen(
				trace(day('2026-12-01'), null, 'interval'),
				{ kind: 'day', dayKey: '2026-12-02' },
				context
			)
		).toMatchObject({ fields: { aboutKind: 'interval' } });
	});
	it('replaces coarse and non-absolute values explicitly and requires a day for clock edits', () => {
		for (const aboutTime of [
			{
				basis: 'absolute',
				precision: 'month',
				certainty: 'approximate',
				start: '2026-12',
				end: null
			} as const,
			{ basis: 'relative', precision: 'unknown', anchorTraceId: 'x', relation: 'after' } as const,
			{ basis: 'unknown' } as const
		]) {
			expect(
				planWhen(trace(aboutTime), { kind: 'day', dayKey: '2026-12-02' }, context)
			).toMatchObject({
				fields: {
					aboutKind: 'instant',
					aboutTime: { precision: 'day', certainty: 'exact' }
				}
			});
			expect(planWhen(trace(aboutTime), { kind: 'time', hours: 10, minutes: 0 }, context)).toEqual({
				ok: false,
				reason: 'needs_day'
			});
			expect(planWhen(trace(aboutTime), { kind: 'clearTime' }, context)).toEqual({
				ok: false,
				reason: 'needs_day'
			});
			expect(whenView(trace(aboutTime), context)).toEqual({
				placement: aboutTime.basis === 'unknown' ? 'undated' : 'inexact',
				weekStart: null,
				dayKey: null,
				time: null,
				canSetTime: false,
				canClearTime: false,
				isExact: false
			});
		}
	});
	it('sets minute precision from a day and clears it back to day', () => {
		expect(
			planWhen(
				trace(day('2026-12-01', 'approximate')),
				{ kind: 'time', hours: 14, minutes: 30 },
				context
			)
		).toMatchObject({ fields: { aboutTime: { precision: 'minute', certainty: 'approximate' } } });
		expect(
			planWhen(trace(minute('2026-12-01T14:30:00+01:00')), { kind: 'clearTime' }, context)
		).toMatchObject({ fields: { aboutTime: { precision: 'day', start: '2026-12-01' } } });
		const weekRange = trace(day('2026-09-14', 'exact', '2026-09-20'), null, 'interval');
		expect(planWhen(weekRange, { kind: 'time', hours: 10, minutes: 30 }, context)).toEqual({
			ok: false,
			reason: 'needs_day'
		});
		expect(
			planWhen(
				trace(minute('2026-12-01T10:00:00+01:00', '2026-12-01T11:00:00+01:00')),
				{ kind: 'clearTime' },
				context
			)
		).toEqual({ ok: false, reason: 'needs_full' });
		expect(
			planWhen(
				trace(minute('2026-12-01T10:00:00+01:00', '2026-12-02T10:00:00+01:00')),
				{ kind: 'clearTime' },
				context
			)
		).toEqual({ ok: false, reason: 'needs_full' });
		for (const bad of [
			{ hours: 24, minutes: 0 },
			{ hours: 1.5, minutes: 0 },
			{ hours: 1, minutes: 60 }
		])
			expect(planWhen(trace(day('2026-12-01')), { kind: 'time', ...bad }, context)).toEqual({
				ok: false,
				reason: 'invalid_target'
			});
	});
	it('collapses the exact Monday-to-Sunday week placeholder when choosing a day', () => {
		const placeholder = trace(day('2026-09-14', 'exact', '2026-09-20'), null, 'interval');
		for (const choice of [
			{ kind: 'day', dayKey: '2026-12-02' },
			{ kind: 'today' },
			{ kind: 'tomorrow' }
		] as const) {
			expect(planWhen(placeholder, choice, context)).toMatchObject({
				fields: {
					aboutKind: 'interval',
					aboutTime: { precision: 'day', end: null }
				}
			});
		}
		expect(planWhen(placeholder, { kind: 'time', hours: 10, minutes: 30 }, context)).toEqual({
			ok: false,
			reason: 'needs_day'
		});
		expect(planWhen(placeholder, { kind: 'clearTime' }, context)).toEqual({
			ok: false,
			reason: 'needs_day'
		});
		const eightDays = trace(day('2026-09-14', 'exact', '2026-09-22'), null, 'interval');
		expect(planWhen(eightDays, { kind: 'day', dayKey: '2026-12-02' }, context)).toMatchObject({
			fields: { aboutTime: { end: '2026-12-10' } }
		});
	});
	it('rejects the missing spring hour and picks the earlier repeated autumn hour', () => {
		expect(
			planWhen(trace(day('2026-03-29')), { kind: 'time', hours: 2, minutes: 30 }, context)
		).toEqual({ ok: false, reason: 'invalid_target' });
		const repeated = planWhen(
			trace(day('2026-10-25')),
			{ kind: 'time', hours: 2, minutes: 30 },
			context
		);
		expect(repeated).toMatchObject({
			fields: { aboutTime: { start: '2026-10-25T02:30:00+02:00' } }
		});
	});
	it('chooses the earlier repeated hour when moving a start and explicit end', () => {
		expect(
			planWhen(
				trace(minute('2026-10-24T02:30:00+02:00')),
				{ kind: 'day', dayKey: '2026-10-25' },
				context
			)
		).toMatchObject({
			fields: { aboutTime: { start: '2026-10-25T02:30:00+02:00' } }
		});
		expect(
			planWhen(
				trace(minute('2026-10-24T02:30:00+02:00', '2026-10-24T03:30:00+02:00'), null, 'interval'),
				{ kind: 'day', dayKey: '2026-10-25' },
				context
			)
		).toMatchObject({
			fields: {
				aboutKind: 'interval',
				aboutTime: {
					start: '2026-10-25T02:30:00+02:00',
					end: '2026-10-25T03:30:00+01:00'
				}
			}
		});
	});
	it('carries local time across the DST boundary', () => {
		expect(
			planWhen(
				trace(minute('2026-03-28T14:00:00+01:00')),
				{ kind: 'day', dayKey: '2026-03-29' },
				context
			)
		).toMatchObject({ fields: { aboutTime: { start: '2026-03-29T14:00:00+02:00' } } });
	});
});

describe('whenView', () => {
	it('projects exact minute/day while hiding ranges and uncertain calendar values', () => {
		expect(whenView(trace(minute('2026-12-01T15:00:00+01:00')), context)).toEqual({
			placement: 'day',
			weekStart: null,
			dayKey: '2026-12-01',
			time: { hours: 15, minutes: 0 },
			canSetTime: true,
			canClearTime: true,
			isExact: true
		});
		expect(
			whenView(trace(day('2026-09-14', 'exact', '2026-09-20'), null, 'interval'), context)
		).toEqual({
			placement: 'week',
			weekStart: '2026-09-14',
			dayKey: null,
			time: null,
			canSetTime: false,
			canClearTime: false,
			isExact: true
		});
		expect(whenView(trace(day('2026-12-01')), context)).toEqual({
			placement: 'day',
			weekStart: null,
			dayKey: '2026-12-01',
			time: null,
			canSetTime: true,
			canClearTime: false,
			isExact: true
		});
		expect(
			whenView(trace(day('2026-09-14', 'exact', '2026-09-22'), null, 'interval'), context)
		).toMatchObject({
			placement: 'day',
			weekStart: null,
			dayKey: '2026-09-14'
		});
		expect(whenView(trace({ basis: 'unknown' }), context)).toMatchObject({
			placement: 'undated',
			weekStart: null
		});
		expect(whenView(trace(null), context)).toMatchObject({ placement: 'undated', weekStart: null });
		const rangedMinute = whenView(
			trace(minute('2026-12-01T15:00:00+01:00', '2026-12-01T16:00:00+01:00')),
			context
		);
		expect(rangedMinute.canClearTime).toBe(false);
		expect(
			whenView(trace(minute('2026-12-01T15:00:00+01:00', null, 'approximate')), context)
		).toEqual({
			placement: 'inexact',
			weekStart: null,
			dayKey: null,
			time: null,
			canSetTime: false,
			canClearTime: true,
			isExact: false
		});
		expect(
			whenView(
				trace({
					basis: 'absolute',
					precision: 'month',
					certainty: 'exact',
					start: '2026-09',
					end: null
				}),
				context
			)
		).toEqual({
			placement: 'inexact',
			weekStart: null,
			dayKey: null,
			time: null,
			canSetTime: false,
			canClearTime: false,
			isExact: true
		});
	});
});
