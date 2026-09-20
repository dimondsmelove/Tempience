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
	it('«длится» is the explicit flag: on, an open interval; off, an empty end is still an instant', () => {
		const instant = absolute('2026-08-10');
		const picker = edit(instant);
		expect(picker.draft.ongoing).toBeUndefined();
		// An empty end alone never means «open».
		expect(placementFromSelection(picker.draft, instant)).toEqual({
			...instant,
			statedDuration: null
		});
		picker.setOngoing(true);
		expect(picker.draft).toMatchObject({ end: null, ongoing: true });
		const open = placementFromSelection(picker.draft, instant);
		expect(open).toEqual({
			...instant,
			aboutKind: 'interval',
			statedDuration: null
		});
		expect(open.aboutTime).toMatchObject({ start: '2026-08-10', end: null });
		// A coarse start keeps the flag: «с августа — длится».
		picker.draft = { ...picker.draft, date: 'month', timed: false };
		expect(placementFromSelection(picker.draft, instant)).toMatchObject({
			aboutKind: 'interval',
			aboutTime: { precision: 'month', start: '2026-08', end: null }
		});
		picker.setOngoing(false);
		expect(placementFromSelection(picker.draft, instant)).toMatchObject({
			aboutKind: 'instant',
			aboutTime: { precision: 'month', start: '2026-08', end: null }
		});
	});
	it('editing an open interval shows «длится» on; an end entered after turning it off closes it («дочитал»)', () => {
		const open: TemporalPlacement = { ...absolute('2026-08-10'), aboutKind: 'interval' };
		const picker = edit(open);
		expect(picker.draft.ongoing).toBe(true);
		expect(picker.draft.end).toBeNull();
		expect(sameSelection(picker.draft, selectionFromPlacement(open))).toBe(true);
		expect(placementFromSelection(picker.draft, open)).toEqual({ ...open, statedDuration: null });
		picker.setOngoing(false);
		expect(sameSelection(picker.draft, selectionFromPlacement(open))).toBe(false);
		picker.beginEnd();
		picker.pick(new Date(2026, 8, 1, 12).getTime());
		expect(picker.draft.ongoing).toBeUndefined();
		expect(placementFromSelection(picker.draft, open)).toEqual({
			...absolute('2026-08-10', '2026-09-01'),
			statedDuration: null
		});
		// Picking an end while the flag is on closes it as well: the two never coexist.
		const again = edit(open);
		again.pick(new Date(2026, 8, 2, 12).getTime(), 'end');
		expect(again.draft.ongoing).toBeUndefined();
		expect(placementFromSelection(again.draft, open).aboutTime).toMatchObject({
			end: '2026-09-02'
		});
	});
	it('«длится» and a stated duration exclude each other; a duration record is not open', () => {
		const amount = {
			...absolute('2026-08-10'),
			aboutKind: 'interval' as const,
			statedDuration: { amount: 3, unit: 'day' as const }
		};
		const picker = edit(amount);
		expect(picker.draft.ongoing).toBeUndefined();
		expect(picker.detail).toBe('duration');
		picker.setOngoing(true);
		expect(picker.draft.ongoing).toBeUndefined();
		expect(placementFromSelection(picker.draft, amount)).toEqual(amount);
		// The other way round: choosing the duration detail drops the flag.
		const open = edit({ ...absolute('2026-08-10'), aboutKind: 'interval' });
		expect(open.draft.ongoing).toBe(true);
		open.setDetail('duration');
		open.setDuration(2, 'day');
		expect(open.draft.ongoing).toBeUndefined();
		expect(placementFromSelection(open.draft, amount)).toMatchObject({
			aboutKind: 'interval',
			statedDuration: { amount: 2, unit: 'day' },
			aboutTime: { end: null }
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
