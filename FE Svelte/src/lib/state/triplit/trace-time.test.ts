import { describe, expect, it } from 'vitest';
import {
	assertTraceTemporalPlacement,
	exactTraceTimeProjection,
	normalizeStoredTraceAboutTime,
	parseTraceAboutTime,
	traceAboutTimeBounds
} from './trace-time';

describe('Trace temporal evidence contract', () => {
	it('normalizes legacy exact timestamps without changing their meaning', () => {
		expect(
			normalizeStoredTraceAboutTime(undefined, 'instant', {
				aboutAt: '2026-04-12T09:30:00.000Z',
				aboutStart: null,
				aboutEnd: null
			})
		).toEqual({
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '2026-04-12T09:30:00.000Z',
			end: null
		});

		expect(
			normalizeStoredTraceAboutTime(undefined, 'interval', {
				aboutAt: null,
				aboutStart: null,
				aboutEnd: null
			})
		).toEqual({ basis: 'unknown' });
	});

	it('preserves exact, approximate, relative, and unknown knowledge states', () => {
		expect(
			parseTraceAboutTime({
				basis: 'absolute',
				precision: 'month',
				certainty: 'exact',
				start: '2026-04',
				end: null
			})
		).toMatchObject({ precision: 'month', certainty: 'exact', start: '2026-04' });
		expect(
			parseTraceAboutTime({
				basis: 'absolute',
				precision: 'year',
				certainty: 'approximate',
				start: '2023',
				end: null
			})
		).toMatchObject({ precision: 'year', certainty: 'approximate' });
		expect(
			parseTraceAboutTime({
				basis: 'relative',
				precision: 'unknown',
				anchorTraceId: 'arrival-in-belgrade',
				relation: 'after'
			})
		).toEqual({
			basis: 'relative',
			precision: 'unknown',
			anchorTraceId: 'arrival-in-belgrade',
			relation: 'after'
		});
		expect(parseTraceAboutTime({ basis: 'unknown' })).toEqual({ basis: 'unknown' });
	});

	it('expands coarse and uncertainty windows without creating fake timestamps', () => {
		expect(
			traceAboutTimeBounds('instant', {
				basis: 'absolute',
				precision: 'month',
				certainty: 'exact',
				start: '2026-04',
				end: null
			})
		).toEqual({
			start: Date.parse('2026-04-01T00:00:00.000Z'),
			end: Date.parse('2026-05-01T00:00:00.000Z')
		});
		expect(
			traceAboutTimeBounds('instant', {
				basis: 'absolute',
				precision: 'month',
				certainty: 'approximate',
				start: '2023-01',
				end: '2023-03'
			})
		).toEqual({
			start: Date.parse('2023-01-01T00:00:00.000Z'),
			end: Date.parse('2023-04-01T00:00:00.000Z')
		});
		expect(
			traceAboutTimeBounds('interval', {
				basis: 'absolute',
				precision: 'month',
				certainty: 'exact',
				start: '2024-10',
				end: '2025-03'
			})
		).toEqual({
			start: Date.parse('2024-10-01T00:00:00.000Z'),
			end: Date.parse('2025-04-01T00:00:00.000Z')
		});
	});

	it('keeps legacy indexed projections exclusive to exact minute evidence', () => {
		const exact = {
			basis: 'absolute' as const,
			precision: 'minute' as const,
			certainty: 'exact' as const,
			start: '2026-04-12T09:30:00.000Z',
			end: null
		};
		expect(exactTraceTimeProjection('instant', exact)).toEqual({
			aboutAt: exact.start,
			aboutStart: null,
			aboutEnd: null
		});
		expect(
			exactTraceTimeProjection('instant', {
				...exact,
				start: '2026-04-12T11:30:00.000+02:00'
			})
		).toMatchObject({ aboutAt: exact.start });
		expect(
			exactTraceTimeProjection('instant', {
				...exact,
				precision: 'month',
				start: '2026-04'
			})
		).toEqual({ aboutAt: null, aboutStart: null, aboutEnd: null });
	});

	it('represents a season as an explicit normalized month window', () => {
		const season = {
			basis: 'absolute' as const,
			precision: 'season' as const,
			certainty: 'exact' as const,
			start: '2025-06',
			end: '2025-08'
		};
		assertTraceTemporalPlacement('instant', season, null);
		expect(traceAboutTimeBounds('instant', season)).toEqual({
			start: Date.parse('2025-06-01T00:00:00.000Z'),
			end: Date.parse('2025-09-01T00:00:00.000Z')
		});
		expect(() => assertTraceTemporalPlacement('instant', { ...season, end: null }, null)).toThrow(
			'Season precision requires'
		);
	});

	it('accepts an interval without an end as open («длится»), at every precision but season', () => {
		const open = (precision: 'minute' | 'day' | 'month' | 'year', start: string) =>
			({ basis: 'absolute', precision, certainty: 'exact', start, end: null }) as const;
		for (const time of [
			open('minute', '2026-08-10T09:00:00.000Z'),
			open('day', '2026-08-10'),
			open('month', '2026-08'),
			open('year', '2026')
		]) {
			expect(() => assertTraceTemporalPlacement('interval', time, null)).not.toThrow();
			// A stated duration with no end is the located start, as before: not an open interval.
			expect(() =>
				assertTraceTemporalPlacement('interval', time, null, { amount: 3, unit: 'day' })
			).not.toThrow();
		}
		expect(() =>
			assertTraceTemporalPlacement(
				'interval',
				{ basis: 'absolute', precision: 'season', certainty: 'exact', start: '2026-06', end: null },
				null
			)
		).toThrow('Season precision requires');
		// The uncertainty rule of an instant is untouched by the open interval.
		expect(() =>
			assertTraceTemporalPlacement(
				'instant',
				{ ...open('day', '2026-08-10'), end: '2026-08-12' },
				null
			)
		).toThrow('Exact instant placement');
		// The exact projection carries the start and «no end yet»; a stated duration keeps none.
		expect(
			exactTraceTimeProjection('interval', open('minute', '2026-08-10T09:00:00.000Z'))
		).toEqual({ aboutAt: null, aboutStart: '2026-08-10T09:00:00.000Z', aboutEnd: null });
		expect(
			exactTraceTimeProjection('interval', open('minute', '2026-08-10T09:00:00.000Z'), {
				amount: 90,
				unit: 'minute'
			})
		).toEqual({ aboutAt: null, aboutStart: null, aboutEnd: null });
		expect(exactTraceTimeProjection('interval', open('day', '2026-08-10'))).toEqual({
			aboutAt: null,
			aboutStart: null,
			aboutEnd: null
		});
		// Its own bounds are the calendar unit of the start; the ribbon stretches it to «сейчас».
		expect(traceAboutTimeBounds('interval', open('day', '2026-08-10'))).toEqual({
			start: Date.parse('2026-08-10T00:00:00.000Z'),
			end: Date.parse('2026-08-11T00:00:00.000Z')
		});
		expect(traceAboutTimeBounds('interval', open('month', '2026-08'))).toEqual({
			start: Date.parse('2026-08-01T00:00:00.000Z'),
			end: Date.parse('2026-09-01T00:00:00.000Z')
		});
		expect(traceAboutTimeBounds('interval', open('minute', '2026-08-10T09:00:00.000Z'))).toEqual({
			start: Date.parse('2026-08-10T09:00:00.000Z'),
			end: Date.parse('2026-08-10T09:30:00.000Z')
		});
	});

	it('enforces shape and Trace placement invariants', () => {
		expect(() =>
			parseTraceAboutTime({
				basis: 'absolute',
				precision: 'day',
				certainty: 'exact',
				start: '2026-02-30',
				end: null
			})
		).toThrow('valid YYYY-MM-DD');
		expect(() =>
			parseTraceAboutTime({
				basis: 'absolute',
				precision: 'minute',
				certainty: 'exact',
				start: '2026-02-30T10:00:00.000Z',
				end: null
			})
		).toThrow('valid ISO timestamp');
		expect(() =>
			assertTraceTemporalPlacement(
				'instant',
				{
					basis: 'absolute',
					precision: 'day',
					certainty: 'exact',
					start: '2026-04-01',
					end: '2026-04-02'
				},
				null
			)
		).toThrow('Exact instant placement');
		expect(() =>
			assertTraceTemporalPlacement('trace_ref', { basis: 'unknown' }, 'trace-1')
		).toThrow('cannot also have aboutTime');
		expect(() =>
			assertTraceTemporalPlacement(
				'interval',
				{
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-04-01T11:00:00.000Z',
					end: '2026-04-01T10:00:00.000Z'
				},
				null
			)
		).toThrow('must end after');
	});
});
