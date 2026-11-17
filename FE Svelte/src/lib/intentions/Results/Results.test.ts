import { expect, it } from 'vitest';
import type { ExplorerIntersection, ExplorerTrace } from '$lib/model/Snapshot/types';
import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
import { intentionRecordRows, intentionResults } from './Results';
const origin = { kind: 'canonical', sourceId: 'test' } as const;
const trace = (id: string, content = id): ExplorerTrace => ({
	id,
	content,
	relation: 'actual',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: null,
	aboutTraceId: null,
	kindId: null,
	kindVId: null,
	data: null,
	origin
});
const link = (id: string, fromId: string, toId = 'task'): ExplorerIntersection => ({
	id,
	fromId,
	toId,
	kind: 'evidence_for',
	context: null,
	origin
});
const assessment = (
	factId: string,
	firstAssessedAt: string,
	extra: Partial<IntentionAssessment> = {}
): IntentionAssessment => ({
	id: factId,
	factId,
	firstAssessedAt,
	source: 'evidence',
	intentionId: 'task',
	originIntentionId: 'task',
	evidenceId: factId,
	activationId: factId,
	placementRevision: null,
	outcome: 'alternative',
	open: false,
	outcomeRevision: null,
	openRevision: null,
	isDeleted: false,
	lifecycleId: 'l',
	createdAt: firstAssessedAt,
	updatedAt: firstAssessedAt,
	...extra
});
it('counts distinct live linked facts and selects the latest alternative for this intention', () => {
	const traces = [trace('a', 'First'), trace('b', 'Second\nrest'), trace('other')];
	const links = [
		link('a', 'a'),
		link('duplicate', 'a'),
		link('b', 'b'),
		link('other', 'other', 'another'),
		link('missing', 'missing')
	];
	const assessments = [
		assessment('a', '2026-01-01T00:00:00.000Z'),
		assessment('b', '2026-02-01T00:00:00.000Z'),
		assessment('missing', '2026-04-01T00:00:00.000Z'),
		assessment('other', '2026-03-01T00:00:00.000Z', { intentionId: 'another' })
	];
	expect(intentionResults('task', traces, links, assessments)).toEqual({
		count: 2,
		alternative: 'Second'
	});
	expect(
		intentionResults(
			'task',
			traces,
			links,
			assessments.map((a) => ({ ...a, isDeleted: true }))
		)
	).toEqual({ count: 2, alternative: null });
});

it('uses event time before assessment creation time and ignores a detached evidence link', () => {
	const a = {
		...trace('a', 'Later event'),
		aboutTime: {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '2026-04-01T12:00:00.000Z',
			end: null
		}
	} as ExplorerTrace;
	const b = {
		...trace('b', 'Earlier event'),
		aboutTime: {
			basis: 'absolute',
			precision: 'minute',
			certainty: 'exact',
			start: '2026-03-01T12:00:00.000Z',
			end: null
		}
	} as ExplorerTrace;
	const links = [link('a', 'a'), link('b', 'b')];
	const statements = [
		assessment('a', '2026-01-01T00:00:00.000Z'),
		assessment('b', '2026-02-01T00:00:00.000Z')
	];
	expect(intentionResults('task', [a, b], links, statements).alternative).toBe('Later event');
	expect(
		intentionResults('task', [a, b], links, [
			{ ...statements[0], evidenceId: 'gone' },
			statements[1]
		]).alternative
	).toBe('Earlier event');
});

it('projects one row per fact using the assessment of its live evidence link', () => {
	const traces = [trace('a'), trace('b'), trace('c')];
	const links = [link('a', 'a'), link('duplicate', 'a'), link('b', 'b'), link('c', 'c')];
	const assessments = [
		assessment('a', '2026-01-01T00:00:00.000Z', { outcome: 'partial' }),
		assessment('b', '2026-01-02T00:00:00.000Z', { outcome: 'completed' }),
		assessment('c', '2026-01-03T00:00:00.000Z', { evidenceId: 'gone' }),
		assessment('a', '2026-01-04T00:00:00.000Z', { intentionId: 'other' })
	];
	expect(
		intentionRecordRows('task', traces, links, assessments).map(({ trace, outcome }) => [
			trace.id,
			outcome
		])
	).toEqual([
		['a', 'partial'],
		['b', 'completed'],
		['c', null]
	]);
});
