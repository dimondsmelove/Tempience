import { describe, expect, it } from 'vitest';
import type { ProjectedRow } from '$lib/model/Projection/types';
import { lineup, system, tree } from './Chapters.fixture';
import {
	chapterArrangement,
	foregroundRowIds,
	lineupNesting,
	lineupRows,
	rowLevels,
	shadowRowIds,
	withDescendants
} from './rows';

describe('the rows a chapter drives', () => {
	it('keeps the device order and only chooses: a child takes the place of its unchosen parent', () => {
		const lanes = chapterArrangement(system.lineup, tree).lanes.map((lane) => lane.members);
		expect(lanes.slice(0, 3)).toEqual([['tempience'], ['people'], ['body']]);
		const device = {
			lanes: ['body', 'work', 'people', 'digital'].map((id) => ({ members: [id] }))
		};
		expect(
			chapterArrangement(system.lineup, tree, device)
				.lanes.slice(0, 3)
				.map((lane) => lane.members)
		).toEqual([['body'], ['people'], ['tempience']]);
		expect(lanes.flat()).toContain('digital');
		expect(lanes.flat()).toContain('work');
	});
	it('folds the rest into one merged row that names itself', () => {
		const lanes = chapterArrangement(system.lineup, tree).lanes;
		expect(lanes).toHaveLength(4);
		expect(lanes[3].name).toBeUndefined();
		expect(lanes[3].members).toEqual(expect.arrayContaining(['digital', 'work']));
	});
	it('names the rows of the unfolded shadow: under the rest, not in front', () => {
		const rows = [
			{ id: 't', depth: 0 },
			{ id: 'rest', depth: 0 },
			{ id: 'w', depth: 1 }
		] as unknown as ProjectedRow[];
		expect([...shadowRowIds(rows, new Set(['t']))]).toEqual(['w']);
	});
	it('unfolds the shadow by its arrow, and folds it back', () => {
		expect(chapterArrangement(system.lineup, tree, null, true).lanes[3].expanded).toBe(true);
		expect(chapterArrangement(system.lineup, tree).lanes[3].expanded).toBeFalsy();
	});
	const row = (id: string, scopeIds: string[]) => ({ id, scopeIds }) as unknown as ProjectedRow;
	const rows = [
		row('r-temp', ['tempience']),
		row('r-people', ['people']),
		row('r-mama', ['mama']),
		row('r-digital', ['digital']),
		row('r-work', ['work'])
	];
	it('keeps the contexts and what is under them in front', () => {
		const front = withDescendants(['tempience', 'people'], tree);
		expect([...front].sort()).toEqual(['mama', 'people', 'tempience']);
		expect([...foregroundRowIds(rows, front)]).toEqual(['r-temp', 'r-people', 'r-mama']);
	});
	it('gives each front row its level, focus winning over support', () => {
		const levels = rowLevels(
			[row('r-t', ['tempience']), row('r-mama', ['mama']), row('r-work', ['work'])],
			lineup(['tempience'], ['people']),
			tree
		);
		expect([...levels]).toEqual([
			['r-t', 'focus'],
			['r-mama', 'support']
		]);
	});
	it('orders the rows focus first, whatever the lineup’s own order', () => {
		const mixed = lineup(['tempience'], ['people']).toReversed();
		const lanes = chapterArrangement(mixed, tree).lanes.map((lane) => lane.members);
		expect(lanes.slice(0, 2)).toEqual([['tempience'], ['people']]);
	});
});

describe('lineupRows', () => {
	it('puts a lineup Scope under its lineup ancestor, a grandchild too, in the order of the tree', () => {
		const tree = {
			scopes: ['money', 'business', 'captain', 'freelance', 'job', 'body', 'clamps'].map((id) => ({
				id
			})),
			intersections: [
				['business', 'money'],
				['captain', 'business'],
				['freelance', 'money'],
				['job', 'money'],
				['clamps', 'body']
			].map(([fromId, toId]) => ({ kind: 'child_of', fromId, toId }))
		} as unknown as Parameters<typeof lineupRows>[1];
		const lineup = ['captain', 'freelance', 'clamps', 'money'].map((scopeId) => ({
			scopeId,
			level: 'focus' as const
		}));
		expect(lineupRows(lineup, tree)).toEqual([
			{ scopeId: 'money', depth: 0 },
			{ scopeId: 'captain', depth: 1 },
			{ scopeId: 'freelance', depth: 1 },
			{ scopeId: 'clamps', depth: 0 }
		]);
	});
});

describe('the shadow of a lineup Scope', () => {
	it('takes the unchosen children of a lineup Scope, not the chosen ones', () => {
		const tree = {
			scopes: ['money', 'business', 'captain', 'freelance', 'job', 'body'].map((id) => ({ id })),
			intersections: [
				['business', 'money'],
				['captain', 'business'],
				['freelance', 'money'],
				['job', 'money']
			].map(([fromId, toId]) => ({ kind: 'child_of', fromId, toId }))
		} as unknown as Parameters<typeof chapterArrangement>[1];
		const lineup = ['captain', 'freelance', 'money'].map((scopeId) => ({
			scopeId,
			level: 'focus' as const
		}));
		const lanes = chapterArrangement(lineup, tree).lanes.map((lane) => lane.members);
		expect(lanes[0]).toEqual(['money']);
		expect(lanes[1]).toEqual(expect.arrayContaining(['body', 'business', 'job']));
		expect(lanes.flat()).not.toContain('freelance');
		expect(lanes.flat()).not.toContain('captain');
		expect([...lineupNesting(lineup, tree).under]).toEqual([['money', ['captain', 'freelance']]]);
	});
});
