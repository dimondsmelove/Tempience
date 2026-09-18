import { describe, expect, it } from 'vitest';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import { dayTime } from '$lib/state/triplit/Traces/record.fixture';
import type { Intersection } from '$lib/state/triplit/types';
import { compareResultRows, resultCandidates, resultRows, type ResultFilter } from './results';
import { plainTrace as trace } from './results.fixture';

const belongs = (traceId: string, scopeId: string): Intersection =>
	({
		id: `${traceId}-${scopeId}`,
		fromId: traceId,
		toId: scopeId,
		kind: 'belongs_to',
		isDeleted: false
	}) as Intersection;

const direct = (
	id: string,
	intentionId: string,
	outcome: IntentionAssessment['outcome'],
	open: boolean | null
): IntentionAssessment =>
	({
		id,
		source: 'direct',
		intentionId,
		originIntentionId: intentionId,
		factId: null,
		evidenceId: null,
		activationId: null,
		outcome,
		open,
		firstAssessedAt: '2026-09-12T08:00:00.000Z',
		isDeleted: false
	}) as IntentionAssessment;

const traces = [
	trace('late', 'Поздний план', 'intend', dayTime('2026-10-01')),
	trace('early', 'Ранний план', 'intend', dayTime('2026-09-20'), { description: 'Про отчёт' }),
	trace('undated', 'План без даты', 'intend'),
	trace('done', 'Закрытый план', 'intend', dayTime('2026-09-25')),
	trace('gone', 'Удалённый план', 'intend', undefined, { isDeleted: true }),
	trace('fact', 'Факт', 'actual', dayTime('2026-09-11'))
];
const intersections = [belongs('early', 'work'), belongs('done', 'work')];
const assessments = [
	direct('s1', 'done', 'completed', false),
	direct('s2', 'late', 'completed', null)
];
const rows = resultRows(traces, intersections, assessments);
const base: ResultFilter = {
	role: 'intention',
	selfId: null,
	query: '',
	scopeId: '',
	from: '',
	to: '',
	all: false
};
const titles = (filter: Partial<ResultFilter>) =>
	resultCandidates(rows, { ...base, ...filter }).map((row) => row.trace.id);

describe('result rows and candidates', () => {
	it('derives each intention state independently and keeps deleted rows readable', () => {
		expect(rows.get('done')?.state).toEqual({ outcome: 'completed', open: false });
		expect(rows.get('late')?.state).toEqual({ outcome: 'completed', open: true });
		expect(rows.get('undated')?.state).toEqual({ outcome: null, open: true });
		expect(rows.get('gone')?.trace.isDeleted).toBe(true);
		expect(rows.get('fact')?.state).toBeNull();
		expect(rows.get('early')?.scopeIds).toEqual(['work']);
	});

	it('offers open intentions by the open projection, in a time order that ignores the outcome', () => {
		// «late» is completed yet open: it stays offered and sits by its date, not by its outcome.
		expect(titles({})).toEqual(['early', 'late', 'undated']);
		expect(titles({ all: true })).toEqual(['early', 'done', 'late', 'undated']);
	});

	it('searches title and description, and filters by Scope and period without any text', () => {
		expect(titles({ query: 'отчёт' })).toEqual(['early']);
		expect(titles({ query: 'план', all: true })).toEqual(['early', 'done', 'late', 'undated']);
		expect(titles({ scopeId: 'work' })).toEqual(['early']);
		expect(titles({ scopeId: 'work', all: true })).toEqual(['early', 'done']);
		expect(titles({ from: '2026-09-21' })).toEqual(['late']);
		expect(titles({ to: '2026-09-21' })).toEqual(['early']);
		expect(titles({ from: '2026-09-20', to: '2026-09-20' })).toEqual(['early']);
		expect(titles({ from: 'nonsense' })).toEqual(['early', 'late', 'undated']);
	});

	it('never offers the edited record, deleted rows or the other role', () => {
		expect(titles({ selfId: 'early' })).toEqual(['late', 'undated']);
		expect(titles({ all: true })).not.toContain('gone');
		expect(titles({ role: 'fact' })).toEqual(['fact']);
	});

	it('orders dated rows by time, undated after them, ties by title', () => {
		const sorted = [rows.get('undated')!, rows.get('late')!, rows.get('early')!].toSorted(
			compareResultRows
		);
		expect(sorted.map((row) => row.trace.id)).toEqual(['early', 'late', 'undated']);
	});
});
