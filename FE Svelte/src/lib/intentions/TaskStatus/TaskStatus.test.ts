import { describe, expect, it, vi } from 'vitest';
import { selectOpen, selectOutcome } from './selection';
import { OUTCOMES, outcomeLabel } from './constants';

describe('panel outcome choices', () => {
	it('shows no outcome for both absent and explicit none, and lists each distinct choice', () => {
		expect(outcomeLabel(null)).toBe('intentions.panelNoOutcome');
		expect(outcomeLabel('none')).toBe('intentions.panelNoOutcome');
		expect(OUTCOMES).toEqual(['none', 'completed', 'partial', 'alternative', 'not_completed']);
		expect(outcomeLabel('partial')).toBe('intentions.panelPartial');
	});
});

it('dispatches independent changes, and reopens result dialogs for the current result', () => {
	const open = vi.fn();
	const outcome = vi.fn();
	selectOpen(true, true, open);
	selectOpen(true, false, open);
	expect(open).toHaveBeenCalledExactlyOnceWith(false);
	selectOutcome(null, 'none', outcome);
	selectOutcome(null, 'not_completed', outcome);
	selectOutcome('partial', 'partial', outcome);
	selectOutcome('alternative', 'alternative', outcome);
	expect(outcome.mock.calls).toEqual([['not_completed'], ['partial'], ['alternative']]);
});
