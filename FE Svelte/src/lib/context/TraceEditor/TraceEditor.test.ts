import { describe, it, expect, vi } from 'vitest';
import { initialTime, temporalPlacement } from './time';
import type { TemporalPlacement } from './types';

describe('Trace editor time contract', () => {
	it('preserves the saved reference placement when opening the editor', () => {
		const existing: TemporalPlacement = {
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: 'anchor'
		};
		expect(temporalPlacement(initialTime(existing), existing)).toEqual(existing);
	});
	it('captures the initial date and time once, including when saving after midnight', () => {
		vi.useFakeTimers();
		try {
			const openedAt = '2026-09-10T23:59:00.000Z';
			vi.setSystemTime(new Date(openedAt));
			const draft = initialTime();
			vi.setSystemTime(new Date('2026-09-11T00:01:00.000Z'));
			expect(temporalPlacement(draft)).toEqual({
				aboutKind: 'instant',
				aboutTraceId: null,
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: openedAt,
					end: null
				}
			});
		} finally {
			vi.useRealTimers();
		}
	});
	it('preserves stored duration and approximate time without recalculating either', () => {
		const existing: TemporalPlacement = {
			aboutKind: 'instant',
			aboutTime: {
				basis: 'absolute',
				precision: 'day',
				certainty: 'approximate',
				start: '2026-09-08',
				end: null
			},
			aboutTraceId: null,
			statedDuration: { amount: 150, unit: 'minute' }
		};
		expect(temporalPlacement(initialTime(existing), existing)).toEqual(existing);
	});
});
