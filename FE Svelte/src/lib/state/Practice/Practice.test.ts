import { describe, expect, it } from 'vitest';
import { projectPractice } from './projection';
import type { PracticeSource } from '$lib/state/triplit/PracticeSettings/types';
import type { Intersection, Trace, TraceKindV } from '$lib/state/triplit/types';

const source: PracticeSource = {
	id: 'source',
	kindId: 'time',
	path: ['group', 'minutes'],
	scopeIds: ['walk', 'read']
};
const version: TraceKindV = {
	id: 'time-v1',
	kindId: 'time',
	generation: 1,
	parentKindVIds: [],
	createdAt: '2026-01-01T00:00:00Z',
	createdByDeviceId: 'test',
	dataSchema: {
		type: 'object',
		properties: { group: { type: 'object', properties: { minutes: { type: 'integer' } } } }
	}
};
const trace = (id: string, patch: Partial<Trace> = {}): Trace => ({
	id,
	capturedAt: '2026-02-01T00:00:00Z',
	timezone: 'UTC',
	aboutKind: 'instant',
	aboutTime: {
		basis: 'absolute',
		precision: 'day',
		certainty: 'exact',
		start: '2026-02-01',
		end: null
	},
	aboutAt: null,
	aboutStart: null,
	aboutEnd: null,
	aboutTraceId: null,
	content: '',
	description: null,
	relation: 'actual',
	kindId: 'time',
	kindVId: 'time-v1',
	data: { group: { minutes: 30 } },
	isDeleted: false,
	lifecycleId: null,
	createdAt: '2026-02-01T00:00:00Z',
	updatedAt: '2026-02-01T00:00:00Z',
	...patch
});
const link = (fromId: string, toId: string, patch: Partial<Intersection> = {}): Intersection => ({
	id: `${fromId}-${toId}`,
	fromId,
	toId,
	kind: 'belongs_to',
	context: null,
	isDeleted: false,
	createdAt: '2026-02-01T00:00:00Z',
	updatedAt: '2026-02-01T00:00:00Z',
	...patch
});

describe('practice projection', () => {
	it('counts day-only time without inventing an hour', () => {
		const result = projectPractice(
			source,
			[trace('day'), trace('collision')],
			[version],
			[link('day', 'walk'), link('collision', 'walk', { fromEntityType: 'traceKind' })],
			['walk', 'read'],
			'UTC'
		);
		expect(result.entries).toMatchObject([
			{ id: 'day', date: '2026-02-01', hour: null, data: { minutes: 30 } }
		]);
		expect(result.issues).toEqual([{ id: 'collision', reason: 'scope' }]);
	});

	it('shows excluded invalid records and ignores intentions and deleted links', () => {
		const result = projectPractice(
			source,
			[
				trace('bad-scope'),
				trace('ambiguous-scope'),
				trace('wrong-version', { kindVId: 'time-v2' }),
				trace('invalid-value', { data: { group: { minutes: 0 } } }),
				trace('intention', { relation: 'intend' })
			],
			[version],
			[
				link('ambiguous-scope', 'walk'),
				link('ambiguous-scope', 'read'),
				link('bad-scope', 'walk', { isDeleted: true })
			],
			['walk', 'read'],
			'UTC'
		);
		expect(result.entries).toEqual([]);
		expect(result.issues).toEqual([
			{ id: 'bad-scope', reason: 'scope' },
			{ id: 'ambiguous-scope', reason: 'scope' },
			{ id: 'wrong-version', reason: 'version' },
			{ id: 'invalid-value', reason: 'value' }
		]);
	});

	it('uses selected field through each immutable version and reports unsupported time', () => {
		const result = projectPractice(
			source,
			[
				trace('approximate', {
					aboutTime: {
						basis: 'absolute',
						precision: 'day',
						certainty: 'approximate',
						start: '2026-02-01',
						end: null
					}
				}),
				trace('time', {
					aboutTime: {
						basis: 'absolute',
						precision: 'minute',
						certainty: 'exact',
						start: '2026-02-01T23:30:00Z',
						end: null
					}
				})
			],
			[version],
			[link('approximate', 'walk'), link('time', 'walk')],
			['walk', 'read'],
			'UTC'
		);
		expect(result.entries).toMatchObject([{ id: 'time', date: '2026-02-01', hour: 23 }]);
		expect(result.issues).toEqual([{ id: 'approximate', reason: 'time' }]);
	});
});
