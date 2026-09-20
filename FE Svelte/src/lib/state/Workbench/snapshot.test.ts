import { describe, expect, it } from 'vitest';
import type {
	IntentionAssessment,
	Intersection,
	Period,
	Scope,
	ScopeSegment,
	Trace
} from '$lib/state/triplit/types';
import {
	day,
	dated,
	direct,
	evidence,
	link,
	trace as intentionTrace
} from '$lib/state/triplit/IntentionAssessments/result.fixture';
import {
	buildRepositoryExplorerSnapshot,
	type ExplorerRepositoryReader
} from '$lib/state/Workbench/snapshot';

const origin = { kind: 'canonical' as const, sourceId: 'source:fixture' };

const trace: Trace = {
	id: 'trace:one',
	capturedAt: '2026-08-29T10:00:00.000Z',
	timezone: 'Europe/Belgrade',
	aboutKind: 'interval',
	aboutTime: {
		basis: 'absolute',
		precision: 'minute',
		certainty: 'approximate',
		start: '2026-08-29T10:00',
		end: '2026-08-29T11:00'
	},
	aboutAt: null,
	aboutStart: '2026-08-29T10:00',
	aboutEnd: '2026-08-29T11:00',
	aboutTraceId: 'trace:anchor',
	content: 'Canonical trace',
	description: null,
	relation: 'actual',
	kindId: 'kind:one',
	kindVId: 'kind-v:one',
	data: { mood: 'focused', score: 8 },
	isDeleted: false,
	lifecycleId: null,
	createdAt: '2026-08-29T10:00:00.000Z',
	updatedAt: '2026-08-29T10:00:00.000Z'
};

const scope: Scope = {
	id: 'scope:all',
	name: 'All scopes are retained',
	note: 'No active scope filtering in the adapter',
	parentScopeId: 'scope:parent',
	startedAt: '2026-08-01T00:00:00.000Z',
	endedAt: null,
	colorHue: 7,
	colorChroma: null,
	colorDepth: 2,
	isDeleted: false,
	createdAt: '2026-08-01T00:00:00.000Z',
	updatedAt: '2026-08-29T00:00:00.000Z'
};

const period: Period = {
	id: 'period:month',
	name: 'August 2026',
	time: { precision: 'month', start: '2026-08', end: '2026-08' },
	timezone: 'Europe/Belgrade',
	note: 'First line of reflection.\nSecond line keeps its shape.',
	isDeleted: false,
	createdAt: '2026-08-01T00:00:00.000Z',
	updatedAt: '2026-08-29T00:00:00.000Z'
};

const periodWithoutNote: Period = {
	...period,
	id: 'period:year',
	name: '2026',
	note: null
};

const intersection: Intersection = {
	id: 'intersection:arbitrary',
	fromId: 'trace:one',
	toId: 'scope:all',
	kind: 'evidence_for',
	context: 'Arbitrary relation context',
	isDeleted: false,
	createdAt: '2026-08-29T00:00:00.000Z',
	updatedAt: '2026-08-29T00:00:00.000Z'
};

const scopeSegment: ScopeSegment = {
	id: 'segment:one',
	scopeId: 'scope:all',
	startAt: '2026-08-10T00:00:00.000Z',
	endAt: '2026-08-20T00:00:00.000Z',
	label: 'Focused phase',
	position: 3,
	createdAt: '2026-08-10T00:00:00.000Z',
	updatedAt: '2026-08-20T00:00:00.000Z'
};

const repositoryWith = (
	values: Partial<{
		traces: Trace[];
		scopes: Scope[];
		periods: Period[];
		intersections: Intersection[];
		scopeSegments: ScopeSegment[];
		assessments: IntentionAssessment[];
	}> = {},
	calls: string[] = []
): ExplorerRepositoryReader => ({
	...(values.assessments
		? { listIntentionAssessments: () => Promise.resolve(values.assessments ?? []) }
		: {}),
	listTraces: (includeDeleted?: boolean) => {
		calls.push(`traces:${includeDeleted}`);
		return Promise.resolve(values.traces ?? []);
	},
	listScopes: (includeDeleted?: boolean) => {
		calls.push(`scopes:${includeDeleted}`);
		return Promise.resolve(values.scopes ?? []);
	},
	listPeriods: (includeDeleted?: boolean) => {
		calls.push(`periods:${includeDeleted}`);
		return Promise.resolve(values.periods ?? []);
	},
	listIntersections: (includeDeleted?: boolean) => {
		calls.push(`intersections:${includeDeleted}`);
		return Promise.resolve(values.intersections ?? []);
	},
	listScopeSegments: (scopeId?: string) => {
		calls.push(`scopeSegments:${scopeId}`);
		return Promise.resolve(values.scopeSegments ?? []);
	}
});

describe('repository Explorer adapter', () => {
	it('maps every canonical collection without losing Explorer fields', async () => {
		const snapshot = await buildRepositoryExplorerSnapshot(
			repositoryWith({
				traces: [trace],
				scopes: [scope],
				periods: [period],
				intersections: [intersection],
				scopeSegments: [scopeSegment]
			}),
			'source:fixture'
		);

		expect(snapshot).toEqual({
			traces: [
				{
					id: 'trace:one',
					content: 'Canonical trace',
					description: null,
					relation: 'actual',
					timezone: 'Europe/Belgrade',
					aboutKind: 'interval',
					aboutTime: trace.aboutTime,
					aboutTraceId: 'trace:anchor',
					kindId: 'kind:one',
					kindVId: 'kind-v:one',
					data: { mood: 'focused', score: 8 },
					origin
				}
			],
			scopes: [
				{
					id: 'scope:all',
					name: 'All scopes are retained',
					note: 'No active scope filtering in the adapter',
					startedAt: '2026-08-01T00:00:00.000Z',
					endedAt: null,
					colorHue: 7,
					colorChroma: null,
					colorDepth: 2,
					origin
				}
			],
			periods: [
				{
					id: 'period:month',
					name: 'August 2026',
					time: period.time,
					timezone: 'Europe/Belgrade',
					note: 'First line of reflection.\nSecond line keeps its shape.',
					origin
				}
			],
			intersections: [
				{
					id: 'intersection:arbitrary',
					fromId: 'trace:one',
					toId: 'scope:all',
					kind: 'evidence_for',
					context: 'Arbitrary relation context',
					origin
				}
			],
			scopeSegments: [
				{
					id: 'segment:one',
					scopeId: 'scope:all',
					startAt: '2026-08-10T00:00:00.000Z',
					endAt: '2026-08-20T00:00:00.000Z',
					label: 'Focused phase',
					position: 3,
					origin
				}
			]
		});
	});

	it('preserves multiline notes and repository-normalized null notes', async () => {
		const snapshot = await buildRepositoryExplorerSnapshot(
			repositoryWith({ periods: [period, periodWithoutNote] }),
			'source:period-notes'
		);

		expect(snapshot.periods).toEqual([
			expect.objectContaining({
				id: period.id,
				note: 'First line of reflection.\nSecond line keeps its shape.'
			}),
			expect.objectContaining({ id: periodWithoutNote.id, note: null })
		]);
	});

	it('loads the complete snapshot without filtering scopes or passing deletion flags', async () => {
		const calls: string[] = [];
		const snapshot = await buildRepositoryExplorerSnapshot(
			repositoryWith({ scopes: [scope, { ...scope, id: 'scope:second' }] }, calls),
			'source:all'
		);

		expect(snapshot.scopes.map(({ id }) => id)).toEqual(['scope:all', 'scope:second']);
		expect(calls).toEqual([
			'traces:undefined',
			'scopes:undefined',
			'periods:undefined',
			'intersections:undefined',
			'scopeSegments:undefined'
		]);
	});

	it('returns an empty snapshot when all repository collections are empty', async () => {
		expect(await buildRepositoryExplorerSnapshot(repositoryWith(), 'source:empty')).toEqual({
			traces: [],
			scopes: [],
			periods: [],
			intersections: [],
			scopeSegments: []
		});
	});

	/**
	 * The closing instant and the closing fact (loop 008, C4): «Сдать» is closed by the fact
	 * «Итог» dated 6 Sep — the ribbon places a day at its midday — and «Ехать» by a direct
	 * statement at its action time; the open «План» carries neither.
	 */
	it('says when a closed intention was closed and which fact closed it', async () => {
		const closedByFact = intentionTrace('i:papers', 'intend', { content: 'Сдать' });
		const closedDirectly = intentionTrace('i:trip', 'intend', { content: 'Ехать' });
		const open = intentionTrace('i:plan', 'intend', { content: 'План' });
		const fact = dated('f:result', day('2026-09-06'), { content: 'Итог' });
		const snapshot = await buildRepositoryExplorerSnapshot(
			repositoryWith({
				traces: [closedByFact, closedDirectly, open, fact],
				intersections: [link('f:result', 'i:papers')],
				assessments: [
					evidence('f:result', 'i:papers', '2026-09-13T08:00:00.000Z', {
						outcome: 'completed',
						open: false
					}),
					direct('d:trip', 'i:trip', '2026-09-14T09:30:00.000Z', { open: false }),
					direct('d:plan', 'i:plan', '2026-09-14T09:30:00.000Z', { outcome: 'partial' })
				]
			}),
			'source:closed'
		);
		const byId = new Map(snapshot.traces.map((row) => [row.id, row]));
		expect(byId.get('i:papers')).toMatchObject({
			intentOpen: false,
			intentOutcome: 'completed',
			intentClosedAt: '2026-09-06T12:00:00.000Z'
		});
		expect(byId.get('i:trip')).toMatchObject({
			intentOpen: false,
			intentOutcome: null,
			intentClosedAt: '2026-09-14T09:30:00.000Z'
		});
		expect(byId.get('i:plan')).toMatchObject({ intentOpen: true, intentOutcome: 'partial' });
		expect(byId.get('i:plan')).not.toHaveProperty('intentClosedAt');
		// The fact says which intention it closed; a direct closing names no fact.
		expect(byId.get('f:result')).toMatchObject({ closesIntentionIds: ['i:papers'] });
		expect(byId.get('f:result')).not.toHaveProperty('intentOpen');
		expect(byId.get('i:papers')).not.toHaveProperty('closesIntentionIds');
	});

	it('propagates a rejected repository read', async () => {
		const error = new Error('repository unavailable');
		const repository: ExplorerRepositoryReader = {
			...repositoryWith(),
			listPeriods: () => Promise.reject(error)
		};

		await expect(buildRepositoryExplorerSnapshot(repository, 'source:error')).rejects.toBe(error);
	});
});
