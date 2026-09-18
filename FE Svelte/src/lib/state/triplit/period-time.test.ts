import { describe, expect, it } from 'vitest';
import { parsePeriodTime, periodTimeBounds } from './period-time';

describe('Period temporal frame contract', () => {
	it('calibrates the reusable Belgrade corpus frames against local calendar boundaries', () => {
		const frames = [
			{
				name: 'Сентябрь 2025',
				time: { precision: 'month' as const, start: '2025-09', end: '2025-09' },
				bounds: ['2025-08-31T22:00:00.000Z', '2025-09-30T22:00:00.000Z']
			},
			{
				name: 'Октябрь 2025',
				time: { precision: 'month' as const, start: '2025-10', end: '2025-10' },
				bounds: ['2025-09-30T22:00:00.000Z', '2025-10-31T23:00:00.000Z']
			},
			{
				name: 'Ноябрь–декабрь 2025',
				time: { precision: 'month' as const, start: '2025-11', end: '2025-12' },
				bounds: ['2025-10-31T23:00:00.000Z', '2025-12-31T23:00:00.000Z']
			},
			{
				name: '2025',
				time: { precision: 'year' as const, start: '2025', end: '2025' },
				bounds: ['2024-12-31T23:00:00.000Z', '2025-12-31T23:00:00.000Z']
			},
			{
				name: 'Январь 2026',
				time: { precision: 'month' as const, start: '2026-01', end: '2026-01' },
				bounds: ['2025-12-31T23:00:00.000Z', '2026-01-31T23:00:00.000Z']
			}
		];

		for (const frame of frames) {
			const bounds = periodTimeBounds(frame.time, 'Europe/Belgrade');
			expect([new Date(bounds.start).toISOString(), new Date(bounds.end).toISOString()]).toEqual(
				frame.bounds
			);
		}
	});

	it('uses a half-open timezone-aware day range across DST', () => {
		const bounds = periodTimeBounds(
			{ precision: 'day', start: '2025-03-30', end: '2025-03-30' },
			'Europe/Belgrade'
		);

		expect(new Date(bounds.start).toISOString()).toBe('2025-03-29T23:00:00.000Z');
		expect(new Date(bounds.end).toISOString()).toBe('2025-03-30T22:00:00.000Z');
		expect(bounds.end - bounds.start).toBe(23 * 60 * 60 * 1000);
	});

	it('keeps explicit minute instants and requires a strict positive interval', () => {
		expect(
			periodTimeBounds(
				{
					precision: 'minute',
					start: '2025-09-01T00:00:00.000+02:00',
					end: '2025-09-01T01:00:00.000+02:00'
				},
				'Europe/Belgrade'
			)
		).toEqual({
			start: Date.parse('2025-08-31T22:00:00.000Z'),
			end: Date.parse('2025-08-31T23:00:00.000Z')
		});
		expect(() =>
			parsePeriodTime({
				precision: 'minute',
				start: '2025-09-01T00:00:00.000Z',
				end: '2025-09-01T00:00:00.000Z'
			})
		).toThrow('must be after start');
	});

	it('rejects open, reversed, malformed, and over-specified ranges', () => {
		expect(() => parsePeriodTime({ precision: 'month', start: '2025-12', end: '2025-11' })).toThrow(
			'must not be before start'
		);
		expect(() => parsePeriodTime({ precision: 'month', start: '2025-12' })).toThrow(
			'must be a non-empty trimmed string'
		);
		expect(() =>
			parsePeriodTime({
				precision: 'month',
				start: '2025-12',
				end: '2025-12',
				certainty: 'exact'
			})
		).toThrow('unsupported fields');
		expect(() =>
			periodTimeBounds({ precision: 'month', start: '2025-12', end: '2025-12' }, 'Not/A_Timezone')
		).toThrow('valid IANA time zone');
	});
});
