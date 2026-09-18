import { describe, expect, it } from 'vitest';
import {
	EXPLORER_CONFORMANCE_IDS,
	createExplorerConformanceSnapshot,
	withExplorerConformanceCoverage
} from '$lib/model/Snapshot/fixture';
import { mergeExplorerSnapshots } from '$lib/model/Snapshot/Snapshot';
import type { ExplorerSnapshot } from '$lib/model/Snapshot/types';

const emptySnapshot = (): ExplorerSnapshot => ({
	traces: [],
	scopes: [],
	periods: [],
	intersections: [],
	scopeSegments: []
});

describe('Explorer synthetic conformance coverage', () => {
	it('covers nested and shared part_of, evidence_for, revisits, and trace_ref', () => {
		const snapshot = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;
		const partOf = snapshot.intersections.filter((intersection) => intersection.kind === 'part_of');

		expect(partOf).toHaveLength(4);
		expect(
			partOf
				.filter((intersection) => intersection.fromId === ids.sharedPart)
				.map((intersection) => intersection.toId)
				.toSorted()
		).toEqual([ids.wholeA, ids.wholeB].toSorted());
		expect(partOf).toContainEqual(
			expect.objectContaining({ fromId: ids.nestedPart, toId: ids.directPart })
		);
		expect(snapshot.intersections).toContainEqual(
			expect.objectContaining({
				fromId: ids.evidence,
				toId: ids.intent,
				kind: 'evidence_for'
			})
		);
		expect(snapshot.intersections).toContainEqual(
			expect.objectContaining({
				fromId: ids.revisit,
				toId: ids.previous,
				kind: 'revisits'
			})
		);
		expect(snapshot.traces.find((trace) => trace.id === ids.reference)).toMatchObject({
			aboutKind: 'trace_ref',
			aboutTime: null,
			aboutTraceId: ids.referenceTarget
		});
		expect(snapshot.traces).toHaveLength(11);
		expect(snapshot.traces.every((trace) => trace.origin.kind === 'synthetic-conformance')).toBe(
			true
		);
	});

	it('is opt-in and rejects entity id collisions while merging', () => {
		const base = emptySnapshot();
		const covered = withExplorerConformanceCoverage(base);

		expect(base.traces).toHaveLength(0);
		expect(covered.traces).toHaveLength(11);
		expect(() => mergeExplorerSnapshots(covered, createExplorerConformanceSnapshot())).toThrow(
			'Duplicate Explorer entity id'
		);
	});
});
