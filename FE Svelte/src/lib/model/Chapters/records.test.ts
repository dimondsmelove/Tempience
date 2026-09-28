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
