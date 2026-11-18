import { describe, expect, it } from 'vitest';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';
import { planFromSnapshot } from './snapshot';

const snapshot = (
	traces: { id: string; relation: string | null }[],
	intersections: { id: string; fromId: string; toId: string; kind: string }[]
) => ({ traces, intersections }) as unknown as ExplorerSnapshot;

describe('planFromSnapshot', () => {
	it('plans active snapshot part_of links, counts mixed descendants once, and preserves shared descendants', () => {
		const result = planFromSnapshot(
			snapshot(
				[
					{ id: 'root', relation: 'intend' },
					{ id: 'child', relation: 'intend' },
					{ id: 'shared', relation: 'intend' },
					{ id: 'live-parent', relation: 'intend' },
					{ id: 'fact', relation: null }
				],
				[
					{ id: 'child-link', fromId: 'child', toId: 'root', kind: 'part_of' },
					{ id: 'shared-link', fromId: 'shared', toId: 'child', kind: 'part_of' },
					{ id: 'live-link', fromId: 'shared', toId: 'live-parent', kind: 'part_of' },
					{ id: 'fact-link', fromId: 'fact', toId: 'root', kind: 'part_of' },
					{ id: 'other-kind', fromId: 'live-parent', toId: 'root', kind: 'related_to' }
				]
			),
			'root'
		);

		expect(result).toEqual({
			deleteIds: ['root', 'child'],
			keptShared: [{ id: 'shared', otherParentIds: ['live-parent'] }],
			descendantCount: 1
		});
		const uniqueReachableSubtasks = new Set(['child', ...result.keptShared.map((item) => item.id)]);
		expect(result.descendantCount + result.keptShared.length).toBe(uniqueReachableSubtasks.size);
	});
	it('returns a zero-delete-descendant plan for all-shared children', () => {
		const result = planFromSnapshot(
			snapshot(
				[
					{ id: 'root', relation: 'intend' },
					{ id: 'shared', relation: 'intend' },
					{ id: 'live', relation: 'intend' }
				],
				[
					{ id: 'root-edge', fromId: 'shared', toId: 'root', kind: 'part_of' },
					{ id: 'live-edge', fromId: 'shared', toId: 'live', kind: 'part_of' }
				]
			),
			'root'
		);

		expect(result).toEqual({
			deleteIds: ['root'],
			keptShared: [{ id: 'shared', otherParentIds: ['live'] }],
			descendantCount: 0
		});
	});
});
