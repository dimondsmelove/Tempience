import { describe, expect, it, vi } from 'vitest';
import { finishResult, hasResultText, tomorrowTarget } from './result';
import { weekStartAt } from '../WeekModel/WeekModel';
import { planPlacement } from '../MoveIntention/MoveIntention';

it('requires non-whitespace text', () => {
	expect(hasResultText(' \n\t')).toBe(false);
	expect(hasResultText(' часть ')).toBe(true);
});

it('uses the local calendar day across DST and midnight', () => {
	expect(tomorrowTarget('Europe/Belgrade', Date.parse('2026-03-28T23:30:00Z'))).toEqual({
		kind: 'day',
		dayKey: '2026-03-30'
	});
	expect(tomorrowTarget('America/Los_Angeles', Date.parse('2026-01-01T01:00:00Z'))).toEqual({
		kind: 'day',
		dayKey: '2026-01-01'
	});
});

it('moves to the displayed week, including Sunday and a past week', () => {
	for (const [anchor, monday] of [
		['2026-03-29T12:00:00Z', '2026-03-23'],
		['2026-03-30T12:00:00Z', '2026-03-30'],
		['2025-12-28T12:00:00Z', '2025-12-22']
	]) {
		const weekStart = weekStartAt(Date.parse(anchor), 'Europe/Belgrade');
		const result = planPlacement(
			{ aboutTime: null },
			{ kind: 'week', weekStart },
			'Europe/Belgrade'
		);
		expect(result.ok && result.fields.aboutTime).toMatchObject({ start: monday });
	}
});

describe('result and move', () => {
	it('retains the saved result and offers its undo when move fails', async () => {
		const undoMove = vi.fn();
		const undoFact = vi.fn();
		const finished = await finishResult(
			'fact',
			{ kind: 'undated' },
			async () => {
				throw new Error('move');
			},
			undoMove,
			undoFact
		);
		expect(finished.moveFailure).toBeInstanceOf(Error);
		await finished.invert();
		expect(undoMove).not.toHaveBeenCalled();
		expect(undoFact).toHaveBeenCalledOnce();
	});
	it('undoes only the fact when the placement produced no journal entry', async () => {
		const undoMove = vi.fn();
		const undoFact = vi.fn();
		const finished = await finishResult(
			'fact',
			{ kind: 'undated' },
			async () => null,
			undoMove,
			undoFact
		);
		await finished.invert();
		expect(undoMove).not.toHaveBeenCalled();
		expect(undoFact).toHaveBeenCalledWith('fact');
	});
	it('retries a failed fact undo without undoing the move twice', async () => {
		const undoMove = vi.fn();
		const undoFact = vi
			.fn()
			.mockRejectedValueOnce(new Error('fact'))
			.mockResolvedValueOnce(undefined);
		const finished = await finishResult(
			'fact',
			{ kind: 'undated' },
			async () => 'move',
			undoMove,
			undoFact
		);
		await expect(finished.invert()).rejects.toThrow('fact');
		await finished.invert();
		expect(undoMove).toHaveBeenCalledOnce();
		expect(undoFact).toHaveBeenCalledTimes(2);
	});
});
