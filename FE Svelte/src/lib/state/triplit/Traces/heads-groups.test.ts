import { describe, expect, it } from 'vitest';
import { groupHeadIds, summaryGroups } from './heads';

describe('the grouping of heads by the leaves of their version', () => {
	it('keeps every group in the heads\u2019 order, each head once, and nothing of unknown versions', () => {
		const groups = summaryGroups([
			{ kindVId: 'v1', paths: [['weight']] },
			{ kindVId: 'v2', paths: [['weight']] },
			{ kindVId: 'v3', paths: [['hours'], ['quality']] },
			{ kindVId: 'v4', paths: [] }
		]);
		expect(groups.map((group) => group.kindVIds)).toEqual([['v3'], ['v1', 'v2']]);
		const heads = [
			{ id: 'a', kindVId: 'v2' },
			{ id: 'b', kindVId: 'v3' },
			{ id: 'c', kindVId: 'v1' },
			{ id: 'd', kindVId: 'v4' },
			{ id: 'e', kindVId: 'nope' },
			{ id: 'f' },
			{ id: 'g', kindVId: 'v2' }
		];
		const ids = groupHeadIds(heads, groups);
		expect([...ids.entries()]).toEqual([
			[groups[1].key, ['a', 'c', 'g']],
			[groups[0].key, ['b']]
		]);
	});

	it('groups a hundred thousand heads in one pass', () => {
		// A copy of the group per head made this quadratic: 24 s for these heads where one pass
		// takes milliseconds. This checks the result at that size; the time is shown by the
		// isolated benchmark of the exact function (group-heads-own.json), not asserted here — a
		// synchronous function blocks the loop, and no same-thread timeout reliably interrupts it.
		const groups = summaryGroups([{ kindVId: 'v1', paths: [['weight']] }]);
		const heads = Array.from({ length: 100_000 }, (_, index) => ({
			id: String(index),
			kindVId: 'v1'
		}));
		const ids = groupHeadIds(heads, groups);
		expect(ids.get(groups[0].key)).toHaveLength(100_000);
		expect(ids.get(groups[0].key)?.at(-1)).toBe('99999');
	});
});
