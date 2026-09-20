import { describe, expect, it } from 'vitest';
import type { Scope, ScopeSegment, Trace } from '$lib/state/triplit';
import {
	buildLocalLifeProjection,
	filledKeysForWeeks,
	scopeWeekStarts,
	traceBounds
} from './triplit-projection';

const scope = (patch: Partial<Scope> = {}): Scope => ({
	id: 'scope-1',
	name: 'Scope 1',
	note: null,
	parentScopeId: null,
	startedAt: '2026-08-03T00:00:00.000Z',
	endedAt: null,
	colorHue: null,
	colorChroma: null,
	colorDepth: null,
	isDeleted: false,
	createdAt: '2026-08-01T00:00:00.000Z',
	updatedAt: '2026-08-01T00:00:00.000Z',
	...patch
});

const trace = (patch: Partial<Trace> = {}): Trace => ({
	id: 'trace-1',
	capturedAt: '2026-08-04T10:00:00.000Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'minute',
		certainty: 'exact',
		start: '2026-08-04T10:00:00.000Z',
		end: null
	},
	aboutAt: '2026-08-04T10:00:00.000Z',
	aboutStart: null,
	aboutEnd: null,
	aboutTraceId: null,
	content: 'Trace',
	description: null,
	relation: 'observe',
	kindId: null,
	kindVId: null,
	data: null,
	isDeleted: false,
	lifecycleId: null,
	createdAt: '2026-08-04T10:00:00.000Z',
	updatedAt: '2026-08-04T10:00:00.000Z',
	...patch
});

const segment = (patch: Partial<ScopeSegment> = {}): ScopeSegment => ({
	id: 'segment-1',
	scopeId: 'scope-1',
	startAt: '2026-08-03T00:00:00.000Z',
	endAt: null,
	label: null,
	position: 0,
	createdAt: '2026-08-03T00:00:00.000Z',
	updatedAt: '2026-08-03T00:00:00.000Z',
	...patch
});

describe('Triplit Life projection', () => {
	it('derives trace and Scope weeks from local entities', () => {
		const projection = buildLocalLifeProjection(
			{ from: '2026-08-03', to: '2026-08-16' },
			[trace()],
			[scope()],
			[segment()],
			'2026-08-05'
		);

		expect(projection.weeks.map((week) => week.week_start)).toEqual(['2026-08-03', '2026-08-10']);
		expect(projection.traceWeekStarts).toEqual(new Set(['2026-08-03']));
		expect(scopeWeekStarts(projection, 'scope-1', false)).toEqual(new Set(['2026-08-03']));
		expect(scopeWeekStarts(projection, 'scope-1', true)).toEqual(
			new Set(['2026-08-03', '2026-08-10'])
		);
	});

	it('projects coarse and approximate evidence without inventing an exact timestamp', () => {
		const bounds = traceBounds(
			trace({
				aboutTime: {
					basis: 'absolute',
					precision: 'month',
					certainty: 'approximate',
					start: '2026-01',
					end: '2026-03'
				},
				aboutAt: null,
				capturedAt: '2026-08-04T10:00:00.000Z'
			})
		);

		expect(bounds).toEqual({
			start: Date.parse('2026-01-01T00:00:00.000Z'),
			end: Date.parse('2026-04-01T00:00:00.000Z')
		});
		expect(
			traceBounds(
				trace({
					aboutTime: { basis: 'unknown' },
					aboutAt: null
				})
			)
		).toBeNull();
	});

	it('rolls filled weeks up to the active grid scale', () => {
		expect(filledKeysForWeeks(['2026-01-05', '2026-01-12', '2027-02-01'], 'month')).toEqual(
			new Set(['2026-01', '2027-02'])
		);
		expect(filledKeysForWeeks(['2026-01-05', '2027-02-01'], 'decade')).toEqual(
			new Set(['2020s', '2020s'])
		);
	});
});
