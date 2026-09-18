import type { IntersectionKind, TraceRelativeTimeRelation } from '$lib/state/triplit/types';
import { explorerEntitiesById } from '$lib/model/Snapshot/Snapshot';
import type {
	ExplorerAnchorEntity,
	ExplorerEntity,
	ExplorerSnapshot
} from '$lib/model/Snapshot/types';

export { explorerAnchorForEntity, explorerEntitiesById } from '$lib/model/Snapshot/Snapshot';
export type {
	ExplorerAnchor,
	ExplorerAnchorEntity,
	ExplorerEntity
} from '$lib/model/Snapshot/types';

export type ExplorerConnectionKind = IntersectionKind | 'trace_ref' | 'temporal_anchor';

export type ExplorerConnection = Readonly<{
	id: string;
	kind: ExplorerConnectionKind;
	fromId: string;
	toId: string;
	source: 'intersection' | 'trace';
	sourceRecordId: string;
	context: string | TraceRelativeTimeRelation | null;
}>;

export type ExplorerNeighbor = Readonly<{
	entity: ExplorerEntity;
	connections: readonly ExplorerConnection[];
}>;

export type ExplorerConnectionDirection = 'incoming' | 'outgoing' | 'from-endpoint' | 'to-endpoint';

export type ExplorerDirectReason = Readonly<{
	kind: ExplorerConnectionKind;
	direction: ExplorerConnectionDirection;
	provenance: 'persisted-intersection' | 'trace-record';
	sourceRecordId: string;
	context: string | TraceRelativeTimeRelation | null;
}>;

/** A single connection viewed from the neighborhood focus. */
export type ExplorerNeighborhoodConnection = Readonly<{
	connection: ExplorerConnection;
	direction: ExplorerConnectionDirection;
	neighborId: string;
	neighbor: ExplorerEntity | null;
	reason: ExplorerDirectReason;
}>;

export type ExplorerNeighborhood = Readonly<{
	focus: ExplorerAnchorEntity;
	connections: readonly ExplorerConnection[];
	neighbors: readonly ExplorerNeighbor[];
	missingEndpointIds: readonly string[];
}>;

export const explorerConnections = (snapshot: ExplorerSnapshot): ExplorerConnection[] => [
	...snapshot.intersections.map((intersection): ExplorerConnection => ({
		id: intersection.id,
		kind: intersection.kind,
		fromId: intersection.fromId,
		toId: intersection.toId,
		source: 'intersection',
		sourceRecordId: intersection.id,
		context: intersection.context
	})),
	...snapshot.traces.flatMap((trace): ExplorerConnection[] => {
		if (trace.aboutKind === 'trace_ref' && trace.aboutTraceId) {
			return [
				{
					id: `trace_ref:${trace.id}`,
					kind: 'trace_ref',
					fromId: trace.id,
					toId: trace.aboutTraceId,
					source: 'trace',
					sourceRecordId: trace.id,
					context: null
				}
			];
		}
		if (trace.aboutTime?.basis === 'relative') {
			return [
				{
					id: `temporal_anchor:${trace.id}`,
					kind: 'temporal_anchor',
					fromId: trace.id,
					toId: trace.aboutTime.anchorTraceId,
					source: 'trace',
					sourceRecordId: trace.id,
					context: trace.aboutTime.relation
				}
			];
		}
		return [];
	})
];

export const explorerNeighborhood = (
	snapshot: ExplorerSnapshot,
	focusId: string
): ExplorerNeighborhood | null => {
	const entitiesById = explorerEntitiesById(snapshot);
	const focus = entitiesById.get(focusId);
	if (!focus || focus.role === 'scopeSegment') return null;

	const allConnections = explorerConnections(snapshot);
	const connections =
		focus.role === 'intersection'
			? allConnections.filter(
					(connection) =>
						connection.source === 'intersection' && connection.sourceRecordId === focusId
				)
			: allConnections.filter(
					(connection) => connection.fromId === focusId || connection.toId === focusId
				);
	const connectionsByNeighborId = new Map<string, ExplorerConnection[]>();
	const missingEndpointIds = new Set<string>();
	const endpoints = connections.flatMap((connection) =>
		focus.role === 'intersection'
			? [connection.fromId, connection.toId]
			: [connection.fromId === focusId ? connection.toId : connection.fromId]
	);
	for (const neighborId of endpoints) {
		if (!entitiesById.has(neighborId)) {
			missingEndpointIds.add(neighborId);
			continue;
		}
		const neighborConnections = connections.filter(
			(connection) => connection.fromId === neighborId || connection.toId === neighborId
		);
		const existingConnections = connectionsByNeighborId.get(neighborId);
		if (existingConnections) {
			for (const connection of neighborConnections) {
				if (!existingConnections.includes(connection)) existingConnections.push(connection);
			}
		} else {
			connectionsByNeighborId.set(neighborId, neighborConnections);
		}
	}

	return {
		focus,
		connections,
		neighbors: [...connectionsByNeighborId].map(([entityId, neighborConnections]) => ({
			entity: entitiesById.get(entityId)!,
			connections: neighborConnections
		})),
		missingEndpointIds: [...missingEndpointIds]
	};
};

/**
 * Returns every direct connection with its direction and opposite endpoint.
 * Missing endpoints remain visible as `neighbor: null` so callers do not lose
 * a connection merely because its other entity is not in the snapshot.
 */
export const explorerNeighborhoodConnections = (
	neighborhood: ExplorerNeighborhood
): readonly ExplorerNeighborhoodConnection[] => {
	const neighborsById = new Map(
		neighborhood.neighbors.map((neighbor) => [neighbor.entity.record.id, neighbor.entity] as const)
	);
	const focusId = neighborhood.focus.record.id;
	const view = (
		connection: ExplorerConnection,
		direction: ExplorerConnectionDirection,
		neighborId: string
	): ExplorerNeighborhoodConnection => ({
		connection,
		direction,
		neighborId,
		neighbor: neighborsById.get(neighborId) ?? null,
		reason: {
			kind: connection.kind,
			direction,
			provenance: connection.source === 'intersection' ? 'persisted-intersection' : 'trace-record',
			sourceRecordId: connection.sourceRecordId,
			context: connection.context
		}
	});

	if (neighborhood.focus.role === 'intersection') {
		return neighborhood.connections.flatMap((connection) => [
			view(connection, 'from-endpoint', connection.fromId),
			view(connection, 'to-endpoint', connection.toId)
		]);
	}

	return neighborhood.connections.map((connection) => {
		const direction: ExplorerConnectionDirection =
			connection.fromId === focusId ? 'outgoing' : 'incoming';
		const neighborId = direction === 'outgoing' ? connection.toId : connection.fromId;

		return view(connection, direction, neighborId);
	});
};
