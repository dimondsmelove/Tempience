import { describe, expect, it } from 'vitest';
import type { HistoryItem } from '$lib/model/History/history';
import { valueText, visibleChanges } from './format';

const item = (changes: HistoryItem['changes']): HistoryItem => ({
	entityType: 'intentionAssessment',
	entityId: 'source-1',
	action: 'updated',
	changes
});

const names = new Map([
	['plan-a', 'Ранний план'],
	['plan-b', 'Поздний план']
]);

describe('how the history of a record reads', () => {
	it('shows an address by the name the Context has for it', () => {
		expect(valueText('intentionId', 'plan-a', names)).toBe('Ранний план');
		// An id this Context cannot name is shown as it is stored, never as a guess.
		expect(valueText('intentionId', 'plan-z', names)).toBe('plan-z');
		// A name is for addresses; text a user wrote is their text, whatever it happens to be.
		expect(valueText('content', 'plan-a', names)).toBe('plan-a');
	});

	it('says one move once, without the identities it was made of', () => {
		const changes = visibleChanges(
			item([
				{ field: 'intentionId', before: 'plan-a', after: 'plan-b' },
				{ field: 'evidenceId', before: 'link-1', after: 'link-2' },
				{ field: 'activationId', before: 'act-1', after: 'act-2' }
			])
		);
		expect(changes.map((change) => change.field)).toEqual(['intentionId']);
	});

	it('leaves out a change whose both sides say nothing', () => {
		expect(visibleChanges(item([{ field: 'outcome', before: null, after: null }]))).toEqual([]);
		expect(
			visibleChanges(item([{ field: 'outcome', before: 'completed', after: null }])).map(
				(change) => change.field
			)
		).toEqual(['outcome']);
	});
});
