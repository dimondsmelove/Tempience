import { describe, expect, it } from 'vitest';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { system, tree } from './Chapters.fixture';
import { countsUnder, recordsIn } from './records';
import { withDescendants } from './rows';
import { ms } from './time';

describe('a chapter’s records', () => {
	it('finds the records of a chapter’s contexts inside its window', () => {
		const trace = (id: string, start: string, relation = 'actual') => ({
			id,
			content: id,
			relation,
			aboutTime: { basis: 'absolute', start }
		});
		const view = {
			traces: [
				trace('in', '2026-09-10T10:00:00+02:00'),
				trace('plan', '2026-09-20T10:00:00+02:00', 'intend'),
				trace('before', '2026-08-10T10:00:00+02:00'),
				trace('elsewhere', '2026-09-10T10:00:00+02:00')
			],
			intersections: [
				{ fromId: 'in', toId: 'mama', kind: 'belongs_to' },
				{ fromId: 'plan', toId: 'tempience', kind: 'belongs_to' },
				{ fromId: 'before', toId: 'mama', kind: 'belongs_to' },
				{ fromId: 'elsewhere', toId: 'work', kind: 'belongs_to' }
			]
		} as unknown as Pick<ExplorerSnapshot, 'traces' | 'intersections'>;
		const found = recordsIn(
			view,
			withDescendants(['people', 'tempience'], tree),
			ms(system.start),
			ms(system.end!),
			new Map()
		);
		expect(found.map((item) => [item.id, item.intent])).toEqual([
			['in', false],
			['plan', true]
		]);
	});
	it('includes unscoped records only without a scope filter and keeps time boundaries', () => {
		const view = {
			traces: [
				{
					id: 'start',
					content: 'start',
					aboutTime: { basis: 'absolute', start: '2026-09-01T00:00:00Z' }
				},
				{
					id: 'end',
					content: 'end',
					aboutTime: { basis: 'absolute', start: '2026-10-01T00:00:00Z' }
				},
				{
					id: 'before',
					content: 'before',
					aboutTime: { basis: 'absolute', start: '2026-08-31T23:59:59Z' }
				},
				{ id: 'undated', content: 'undated' },
				{
					id: 'linked',
					content: 'linked',
					aboutTime: { basis: 'absolute', start: '2026-09-02T00:00:00Z' }
				}
			],
			intersections: [
				{ fromId: 'linked', toId: 'work', kind: 'belongs_to' },
				{ fromId: 'linked', toId: 'health', kind: 'belongs_to' }
			]
		} as unknown as Pick<ExplorerSnapshot, 'traces' | 'intersections'>;
		const start = Date.parse('2026-09-01T00:00:00Z');
		const end = Date.parse('2026-10-01T00:00:00Z');
		const all = recordsIn(view, null, start, end, new Map());
		expect(all.map((item) => item.id)).toEqual(['start', 'linked']);
		expect(all[0].scopeIds).toEqual([]);
		expect(all[1].scopeIds).toEqual(['work', 'health']);
		expect(
			recordsIn(view, new Set(['work']), start, end, new Map()).map((item) => item.id)
		).toEqual(['linked']);
	});
});

describe('countsUnder', () => {
	it('counts a lineup Scope with its nested Scopes, a record under two for both', () => {
		const tree = {
			scopes: [{ id: 'work' }, { id: 'temp' }, { id: 'health' }],
			intersections: [{ kind: 'child_of', fromId: 'temp', toId: 'work' }]
		} as unknown as Pick<ExplorerSnapshot, 'scopes' | 'intersections'>;
		const record = (id: string, scopeIds: string[]) => ({
			id,
			title: id,
			at: 0,
			intent: false,
			scopeIds
		});
		const counts = countsUnder(
			[record('a', ['temp']), record('b', ['work', 'health']), record('c', ['health'])],
			['work', 'health'],
			tree
		);
		expect([...counts]).toEqual([
			['work', 2],
			['health', 2]
		]);
	});
});
