import { describe, expect, it } from 'vitest';
import {
	EXPLORER_CONFORMANCE_IDS,
	createExplorerConformanceSnapshot
} from '$lib/model/Snapshot/fixture';
import {
	explorerEntitiesById,
	explorerNeighborhood,
	explorerNeighborhoodConnections
} from '$lib/model/Neighborhood/anchors';
import type {
	ExplorerIntersection,
	ExplorerSnapshot,
	ExplorerTrace
} from '$lib/model/Snapshot/types';

const addIntersections = (
	snapshot: ExplorerSnapshot,
	...intersections: ExplorerIntersection[]
): ExplorerSnapshot => ({
	...snapshot,
	intersections: [...snapshot.intersections, ...intersections]
});

const intersection = (
	snapshot: ExplorerSnapshot,
	id: string,
	fromId: string,
	toId: string,
	kind: ExplorerIntersection['kind']
): ExplorerIntersection => ({
	id,
	fromId,
	toId,
	kind,
	context: null,
	origin: snapshot.traces[0]?.origin ?? snapshot.scopes[0].origin
});

describe('Explorer neighborhood', () => {
	it('keeps every direct typed connection without a render quota', () => {
		const snapshot = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;
		const neighborhood = explorerNeighborhood(snapshot, ids.sharedPart);

		expect(neighborhood).not.toBeNull();
		expect(neighborhood!.connections.map((connection) => connection.kind).toSorted()).toEqual([
			'belongs_to',
			'part_of',
			'part_of'
		]);
		expect(neighborhood!.neighbors.map((neighbor) => neighbor.entity.record.id).toSorted()).toEqual(
			[ids.scope, ids.wholeA, ids.wholeB].toSorted()
		);
		expect(neighborhood!.missingEndpointIds).toEqual([]);
	});

	it('makes evidence, revisit, and trace_ref traversable in either direction', () => {
		const snapshot = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;

		expect(explorerNeighborhood(snapshot, ids.intent)?.connections).toContainEqual(
			expect.objectContaining({
				kind: 'evidence_for',
				fromId: ids.evidence,
				toId: ids.intent
			})
		);
		expect(explorerNeighborhood(snapshot, ids.previous)?.connections).toContainEqual(
			expect.objectContaining({
				kind: 'revisits',
				fromId: ids.revisit,
				toId: ids.previous
			})
		);
		expect(explorerNeighborhood(snapshot, ids.referenceTarget)?.connections).toContainEqual(
			expect.objectContaining({
				kind: 'trace_ref',
				fromId: ids.reference,
				toId: ids.referenceTarget,
				source: 'trace'
			})
		);
	});

	it('projects part_of and belongs_to with direction from the focus', () => {
		const snapshot = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;

		expect(
			explorerNeighborhoodConnections(explorerNeighborhood(snapshot, ids.sharedPart)!).map(
				(view) => [view.connection.kind, view.direction, view.neighborId]
			)
		).toEqual([
			['belongs_to', 'outgoing', ids.scope],
			['part_of', 'outgoing', ids.wholeA],
			['part_of', 'outgoing', ids.wholeB]
		]);

		const wholeAViews = explorerNeighborhoodConnections(
			explorerNeighborhood(snapshot, ids.wholeA)!
		);
		expect(
			wholeAViews
				.filter((view) => view.connection.kind === 'part_of')
				.map((view) => [view.direction, view.neighborId])
		).toEqual([
			['incoming', ids.directPart],
			['incoming', ids.sharedPart]
		]);

		const scopeViews = explorerNeighborhoodConnections(explorerNeighborhood(snapshot, ids.scope)!);
		expect(scopeViews.every((view) => view.connection.kind === 'belongs_to')).toBe(true);
		expect(scopeViews.every((view) => view.direction === 'incoming')).toBe(true);
		expect(scopeViews.every((view) => view.neighbor?.role === 'trace')).toBe(true);
	});

	it('keeps relation direction for evidence, revisits, and related_to', () => {
		const base = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;
		const snapshot = addIntersections(
			base,
			intersection(base, 'fixture:related', ids.intent, ids.previous, 'related_to')
		);

		const intentViews = explorerNeighborhoodConnections(
			explorerNeighborhood(snapshot, ids.intent)!
		);
		expect(
			intentViews.map((view) => [view.connection.kind, view.direction, view.neighborId])
		).toContainEqual(['evidence_for', 'incoming', ids.evidence]);
		expect(
			intentViews.map((view) => [view.connection.kind, view.direction, view.neighborId])
		).toContainEqual(['related_to', 'outgoing', ids.previous]);

		const revisitViews = explorerNeighborhoodConnections(
			explorerNeighborhood(snapshot, ids.revisit)!
		);
		expect(revisitViews).toContainEqual(
			expect.objectContaining({
				connection: expect.objectContaining({ kind: 'revisits' }),
				direction: 'outgoing',
				neighborId: ids.previous,
				neighbor: expect.objectContaining({ role: 'trace' })
			})
		);
	});

	it('projects trace_ref and relative temporal_anchor in either direction', () => {
		const base = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;
		const relativeTrace: ExplorerTrace = {
			...base.traces[0],
			id: 'fixture:relative-trace',
			aboutTime: {
				basis: 'relative',
				precision: 'day',
				anchorTraceId: ids.previous,
				relation: 'after'
			}
		};
		const snapshot: ExplorerSnapshot = {
			...base,
			traces: [...base.traces, relativeTrace]
		};

		const targetViews = explorerNeighborhoodConnections(
			explorerNeighborhood(snapshot, ids.referenceTarget)!
		);
		expect(targetViews).toContainEqual(
			expect.objectContaining({
				connection: expect.objectContaining({ kind: 'trace_ref' }),
				direction: 'incoming',
				neighborId: ids.reference,
				reason: expect.objectContaining({
					provenance: 'trace-record',
					sourceRecordId: ids.reference
				})
			})
		);

		const anchorViews = explorerNeighborhoodConnections(
			explorerNeighborhood(snapshot, ids.previous)!
		);
		expect(anchorViews).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					connection: expect.objectContaining({ kind: 'temporal_anchor' }),
					direction: 'incoming',
					neighborId: relativeTrace.id
				})
			])
		);
	});

	it('keeps an Intersection as a selectable anchor and explains both endpoints', () => {
		const base = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;
		const relation = intersection(
			base,
			'fixture:intersection-anchor',
			ids.sharedPart,
			ids.wholeA,
			'part_of'
		);
		const snapshot = addIntersections(base, relation);

		expect(explorerEntitiesById(snapshot).get(relation.id)).toEqual({
			role: 'intersection',
			record: relation
		});

		const neighborhood = explorerNeighborhood(snapshot, relation.id);
		expect(neighborhood?.focus).toEqual({ role: 'intersection', record: relation });
		expect(
			explorerNeighborhoodConnections(neighborhood!).map((view) => ({
				direction: view.direction,
				neighborId: view.neighborId,
				provenance: view.reason.provenance,
				sourceRecordId: view.reason.sourceRecordId
			}))
		).toEqual([
			{
				direction: 'from-endpoint',
				neighborId: ids.sharedPart,
				provenance: 'persisted-intersection',
				sourceRecordId: relation.id
			},
			{
				direction: 'to-endpoint',
				neighborId: ids.wholeA,
				provenance: 'persisted-intersection',
				sourceRecordId: relation.id
			}
		]);
	});

	it('keeps multiple connections to one neighbor and preserves missing endpoints', () => {
		const base = createExplorerConformanceSnapshot();
		const ids = EXPLORER_CONFORMANCE_IDS;
		const snapshot = addIntersections(
			base,
			intersection(base, 'fixture:duplicate-part', ids.sharedPart, ids.wholeA, 'contains'),
			intersection(
				base,
				'fixture:missing',
				ids.sharedPart,
				'fixture:missing-endpoint',
				'related_to'
			)
		);

		const views = explorerNeighborhoodConnections(explorerNeighborhood(snapshot, ids.sharedPart)!);
		expect(views.filter((view) => view.neighborId === ids.wholeA)).toHaveLength(2);
		expect(views.find((view) => view.neighborId === 'fixture:missing-endpoint')).toEqual(
			expect.objectContaining({
				direction: 'outgoing',
				neighborId: 'fixture:missing-endpoint',
				neighbor: null
			})
		);
	});
});
