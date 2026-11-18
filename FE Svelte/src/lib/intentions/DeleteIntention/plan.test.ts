import { describe, expect, it } from 'vitest';
import { planDeleteIntention } from './plan';

const intention = (id: string) => ({ id, isIntention: true });
const fact = (id: string) => ({ id, isIntention: false });
const edge = (fromId: string, toId: string) => ({ fromId, toId });

describe('planDeleteIntention', () => {
	it('deletes direct children in all mode and only the selected intention in only mode', () => {
		const intentions = ['root', 'childA', 'childB', 'neighbor'].map(intention);
		const edges = [edge('childA', 'root'), edge('childB', 'root')];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toEqual({
			deleteIds: ['root', 'childA', 'childB'],
			keptShared: [],
			descendantCount: 2
		});
		expect(planDeleteIntention('root', 'only', intentions, edges)).toEqual({
			deleteIds: ['root'],
			keptShared: [],
			descendantCount: 0
		});
	});

	it('includes nested descendants transitively', () => {
		expect(
			planDeleteIntention('root', 'all', ['root', 'child', 'grandchild'].map(intention), [
				edge('child', 'root'),
				edge('grandchild', 'child')
			])
		).toMatchObject({ deleteIds: ['root', 'child', 'grandchild'], descendantCount: 2 });
	});

	it('deletes a diamond only when every parent is in the deletion set', () => {
		const intentions = ['root', 'left', 'right', 'shared'].map(intention);
		const edges = [
			edge('left', 'root'),
			edge('right', 'root'),
			edge('shared', 'left'),
			edge('shared', 'right')
		];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toMatchObject({
			deleteIds: ['root', 'left', 'right', 'shared'],
			keptShared: []
		});
	});

	it('keeps a shared descendant and reports its other parent in all mode', () => {
		const intentions = ['root', 'child', 'otherParent', 'shared'].map(intention);
		const edges = [edge('child', 'root'), edge('shared', 'child'), edge('shared', 'otherParent')];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toEqual({
			deleteIds: ['root', 'child'],
			keptShared: [{ id: 'shared', otherParentIds: ['otherParent'] }],
			descendantCount: 1
		});
	});

	it('keeps mixed descendants whose other parent is outside the reachable subtree', () => {
		const intentions = ['root', 'child', 'shared', 'outside'].map(intention);
		const edges = [edge('child', 'root'), edge('shared', 'child'), edge('shared', 'outside')];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toMatchObject({
			deleteIds: ['root', 'child'],
			keptShared: [{ id: 'shared', otherParentIds: ['outside'] }]
		});
	});

	it('keeps every direct child shared with an outside parent, so descendant count is zero', () => {
		const intentions = ['root', 'childA', 'childB', 'outsideA', 'outsideB'].map(intention);
		const edges = [
			edge('childA', 'root'),
			edge('childA', 'outsideA'),
			edge('childB', 'root'),
			edge('childB', 'outsideB')
		];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toEqual({
			deleteIds: ['root'],
			keptShared: [
				{ id: 'childA', otherParentIds: ['outsideA'] },
				{ id: 'childB', otherParentIds: ['outsideB'] }
			],
			descendantCount: 0
		});
	});

	it('keeps a reachable A↔B cycle when neither node has all parents in the deletion set', () => {
		const intentions = ['root', 'A', 'B'].map(intention);
		const edges = [edge('A', 'root'), edge('B', 'A'), edge('A', 'B')];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toEqual({
			deleteIds: ['root'],
			keptShared: [
				{ id: 'A', otherParentIds: ['B'] },
				{ id: 'B', otherParentIds: ['A'] }
			],
			descendantCount: 0
		});
	});

	it('deletes all reachable shared descendants when every parent is also deleted', () => {
		const intentions = ['root', 'left', 'right', 'shared', 'leaf'].map(intention);
		const edges = [
			edge('left', 'root'),
			edge('right', 'root'),
			edge('shared', 'left'),
			edge('shared', 'right'),
			edge('leaf', 'shared')
		];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toMatchObject({
			deleteIds: ['root', 'leaf', 'left', 'right', 'shared'],
			keptShared: []
		});
	});

	it('keeps traversal finite while ignoring non-intentions and unknown endpoints', () => {
		const intentions = [intention('root'), intention('child'), fact('fact')];
		const edges = [
			edge('child', 'root'),
			edge('root', 'child'),
			edge('fact', 'root'),
			edge('unknown', 'root'),
			edge('child', 'missing')
		];

		expect(planDeleteIntention('root', 'all', intentions, edges)).toMatchObject({
			deleteIds: ['root', 'child'],
			descendantCount: 1
		});
	});
});
