import { describe, expect, it } from 'vitest';
import { TimeInputState } from '$lib/ui/TimeInput/TimeInputState.svelte';
import { measuredDuration } from '$lib/ui/TimeInput/duration';
import { traceDuration } from '$lib/state/triplit/trace-duration';
import { traceAboutTimeBounds } from '$lib/state/triplit/trace-time';
import { initialTime, temporalPlacement } from './time';
import { placementFromSelection, selectionFromPlacement, sameSelection } from './selection';
import type { TemporalPlacement } from './types';

const absolute = (
	start: string,
	end: string | null = null,
	precision: 'day' | 'minute' | 'month' | 'season' | 'year' = 'day',
	approximate = false
): TemporalPlacement => ({
	aboutKind: end === null ? 'instant' : 'interval',
	aboutTraceId: null,
	aboutTime: {
		basis: 'absolute',
		precision,
		certainty: approximate ? 'approximate' : 'exact',
		start,
		end
	}
});
const unknown: TemporalPlacement = {
	aboutKind: 'instant',
	aboutTime: { basis: 'unknown' },
	aboutTraceId: null
};
const edit = (original: TemporalPlacement) => {
	const picker = new TimeInputState(selectionFromPlacement(original));
	picker.open();
	return picker;
};

describe('shared input to stored trace placement', () => {
	it('preserves non-day and unresolved values on open and apply without an edit', () => {
		const originals: TemporalPlacement[] = [
			unknown,
			{ aboutKind: 'trace_ref', aboutTime: null, aboutTraceId: 'anchor' },
			{
				aboutKind: 'instant',
				aboutTraceId: null,
				aboutTime: {
					basis: 'relative',
					precision: 'unknown',
					anchorTraceId: 'anchor',
					relation: 'after'
				}
			},
			{ ...absolute('2025-12', '2026-02', 'season'), aboutKind: 'instant' },
			absolute('2026-09-09T09:00:13+02:00', '2026-09-09T11:30:13+02:00', 'minute'),
			{
				...absolute('2026-09-01', '2026-09-10', 'day', true),
				statedDuration: { amount: 4, unit: 'day' }
			}
		];
		for (const original of originals) {
			const picker = edit(original);
			picker.switchInput('timeline');
			picker.switchInput('picker');
			expect(
				sameSelection(picker.draft, selectionFromPlacement(original, picker.draft.start))
			).toBe(true);
			expect(temporalPlacement(initialTime(original), original)).toEqual(original);
		}
	});
	it('stores a quantity with an unknown date without inventing a calendar day', () => {
		const picker = edit(unknown);
		picker.setDetail('duration');
		picker.setDurationTime(2, 30);
		const chosen = placementFromSelection(picker.draft, unknown);
		expect(chosen).toEqual({
			...unknown,
			aboutKind: 'interval',
			statedDuration: { amount: 150, unit: 'minute' }
		});
		expect(
			traceAboutTimeBounds(chosen.aboutKind, chosen.aboutTime, chosen.statedDuration)
		).toBeNull();
		expect(temporalPlacement({ mode: 'chosen', chosen })).toEqual(chosen);
	});
	it('keeps the possible-start window while changing quantity, without deriving its width', () => {
		const original = {
			...absolute('2026-09-01', '2026-09-10', 'day', true),
			statedDuration: { amount: 4, unit: 'day' as const }
		};
		const picker = edit(original);
		expect(picker.draft.window).toBe(true);
		expect(measuredDuration(picker.draft)).toBeNull();
		picker.setDuration(5, 'day');
		expect(placementFromSelection(picker.draft, original)).toEqual({
			...original,
			statedDuration: { amount: 5, unit: 'day' }
		});
		picker.setDetail('clock');
		expect(measuredDuration(picker.draft)).toBeNull();
		picker.setDetail('duration');
		expect(picker.draft.duration).toEqual({ amount: 5, unit: 'day' });
		expect(placementFromSelection(picker.draft, original).aboutTime).toEqual(original.aboutTime);
	});
	it('replaces manual duration with actual clocks, then carries their measured amount when removed', () => {
		const original = {
			...absolute('2026-09-09'),
			aboutKind: 'interval' as const,
			statedDuration: { amount: 120, unit: 'minute' as const }
		};
		const picker = edit(original);
		picker.setDetail('clock');
		picker.clock(9, 0);
		picker.beginEnd();
		picker.clock(11, 30);
		expect(picker.durationNotice).toContain('2 ч 30 мин');
		const placed = placementFromSelection(picker.draft, original);
		expect(placed.statedDuration).toBeNull();
		expect(traceDuration(placed)).toEqual({ amount: 150, unit: 'minute' });
		picker.removeTime();
		expect(placementFromSelection(picker.draft, placed)).toEqual({
			...original,
			statedDuration: { amount: 150, unit: 'minute' }
		});
	});
	it('carries calendar day counts without converting days to hours', () => {
		const original = absolute('2026-10-24', '2026-10-26');
		const picker = edit(original);
		picker.setDetail('duration');
		expect(picker.draft.duration).toEqual({ amount: 3, unit: 'day' });
		expect(placementFromSelection(picker.draft, original)).toEqual({
			...absolute('2026-10-24'),
			aboutKind: 'interval',
			statedDuration: { amount: 3, unit: 'day' }
		});
	});
	it('selects coarse months and years without persisting invented first-day precision', () => {
		for (const precision of ['month', 'year'] as const) {
			const original = absolute(precision === 'month' ? '2026-09' : '2026', null, precision);
			const picker = edit(original);
			picker.setDetail('duration');
			picker.setDuration(4, 'day');
			expect(placementFromSelection(picker.draft, original)).toEqual({
				...original,
				aboutKind: 'interval',
				statedDuration: { amount: 4, unit: 'day' }
			});
			picker.switchInput('timeline');
			picker.pick(new Date(2026, 9, 9, 12).getTime());
			expect(placementFromSelection(picker.draft, original).aboutTime).toMatchObject({
				precision: 'day',
				start: '2026-10-09'
			});
		}
	});
});
