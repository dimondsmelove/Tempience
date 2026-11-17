import { describe, expect, it } from 'vitest';
import type { ExplorerTrace } from '$lib/model/Snapshot/types';
import { closedDayLabel, closedIntentions } from './Closed';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';

const trace = (id: string, patch: Partial<ExplorerTrace> = {}): ExplorerTrace => ({
	id,
	content: id,
	relation: 'intend',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: null,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin: { kind: 'canonical', sourceId: 'test' },
	...patch
});

describe('closedIntentions', () => {
	it('orders by completion evidence, groups by local day and puts missing facts last', () => {
		const traces = [
			trace('no-fact', {
				intentOpen: false,
				intentOutcome: 'completed'
			}),
			trace('without-date', {
				intentOpen: false,
				intentOutcome: 'completed'
			}),
			trace('early', {
				intentOpen: false,
				intentOutcome: 'completed'
			}),
			trace('late', {
				intentOpen: false,
				intentOutcome: 'completed'
			}),
			trace('fact-early', {
				relation: 'actual',
				closesIntentionIds: ['early'],
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-11-16T09:00:00Z',
					end: null
				}
			}),
			trace('fact-late', {
				relation: 'actual',
				closesIntentionIds: ['late'],
				aboutTime: {
					basis: 'absolute',
					precision: 'minute',
					certainty: 'exact',
					start: '2026-11-16T23:30:00Z',
					end: null
				}
			}),
			trace('fact-without-date', { relation: 'actual', closesIntentionIds: ['without-date'] }),
			trace('open')
		];
		const assessments = [
			['early', 'fact-early'],
			['late', 'fact-late'],
			['without-date', 'fact-without-date']
		].map(
			([intentionId, factId]) =>
				({
					intentionId,
					factId,
					source: 'evidence',
					outcome: 'completed',
					open: false,
					isDeleted: false
				}) as IntentionAssessment
		);
		const result = closedIntentions({ traces }, assessments, 'Europe/Belgrade', 50);
		expect(result.total).toBe(4);
		expect(
			closedIntentions(
				{ traces },
				assessments.map((item) => ({ ...item, outcome: 'partial' })),
				'UTC',
				50
			).groups.map((group) => group.day)
		).toEqual([null]);
		expect(result.groups.map((group) => [group.day, group.items.map((item) => item.id)])).toEqual([
			['2026-11-17', ['late']],
			['2026-11-16', ['early']],
			[null, ['no-fact', 'without-date']]
		]);
		expect(
			closedIntentions({ traces }, assessments, 'UTC', 1).groups.flatMap((group) =>
				group.items.map((item) => item.id)
			)
		).toEqual(['late']);
	});
});

it('groups other closed outcomes by their projected closing source and leaves missing dates last', () => {
	const traces = [
		trace('partial', {
			intentOpen: false,
			intentOutcome: 'partial',
			intentClosedAt: '2025-01-02T12:00:00Z'
		}),
		trace('none', { intentOpen: false, intentOutcome: null, intentClosedAt: null }),
		trace('other', {
			intentOpen: false,
			intentOutcome: 'alternative',
			intentClosedAt: '2026-11-17T12:00:00Z'
		}),
		trace('invalid', {
			intentOpen: false,
			intentOutcome: 'not_completed',
			intentClosedAt: 'invalid'
		})
	];
	expect(
		closedIntentions({ traces }, [], 'UTC').groups.map((g) => [g.day, g.items.map((t) => t.id)])
	).toEqual([
		['2026-11-17', ['other']],
		['2025-01-02', ['partial']],
		[null, ['invalid', 'none']]
	]);
});

it('filters before the limit and reports the matching total', () => {
	const traces = Array.from({ length: 55 }, (_, i) =>
		trace(`task-${String(i).padStart(2, '0')}`, {
			intentOpen: false,
			content: i === 54 ? 'НАЙДИ меня' : 'Другое'
		})
	);
	const result = closedIntentions({ traces }, [], 'UTC', 1, 'найди', 'ru');
	expect(result.total).toBe(1);
	expect(result.groups[0].items.map((item) => item.id)).toEqual(['task-54']);
});

it('includes the year only when it differs from the current year', () => {
	expect(closedDayLabel('2026-11-17', '2026-11-20', 'ru-RU')).toBe('вт 17 нояб.');
	expect(closedDayLabel('2025-11-17', '2026-11-20', 'ru-RU')).toContain('2025');
});
