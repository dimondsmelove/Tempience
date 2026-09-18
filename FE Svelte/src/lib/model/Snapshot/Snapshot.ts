import type { ExplorerAnchor, ExplorerEntity, ExplorerSnapshot } from './types';

export const explorerEntitiesById = (
	snapshot: ExplorerSnapshot
): ReadonlyMap<string, ExplorerEntity> =>
	new Map<string, ExplorerEntity>([
		...snapshot.traces.map((trace): [string, ExplorerEntity] => [
			trace.id,
			{ role: 'trace', record: trace }
		]),
		...snapshot.scopes.map((scope): [string, ExplorerEntity] => [
			scope.id,
			{ role: 'scope', record: scope }
		]),
		...snapshot.periods.map((period): [string, ExplorerEntity] => [
			period.id,
			{ role: 'period', record: period }
		]),
		...snapshot.intersections.map((intersection): [string, ExplorerEntity] => [
			intersection.id,
			{ role: 'intersection', record: intersection }
		]),
		...snapshot.scopeSegments.map((scopeSegment): [string, ExplorerEntity] => [
			scopeSegment.id,
			{ role: 'scopeSegment', record: scopeSegment }
		])
	]);

export const explorerAnchorForEntity = (entity: ExplorerEntity): ExplorerAnchor | null =>
	entity.role === 'scopeSegment' ? null : { role: entity.role, entityId: entity.record.id };

const snapshotRecords = (
	snapshot: ExplorerSnapshot
): readonly (readonly [role: string, records: readonly { id: string }[]])[] => [
	['trace', snapshot.traces],
	['scope', snapshot.scopes],
	['period', snapshot.periods],
	['intersection', snapshot.intersections],
	['scopeSegment', snapshot.scopeSegments]
];

export const mergeExplorerSnapshots = (
	base: ExplorerSnapshot,
	...overlays: readonly ExplorerSnapshot[]
): ExplorerSnapshot => {
	const snapshots = [base, ...overlays];
	const merged: ExplorerSnapshot = {
		traces: snapshots.flatMap((snapshot) => snapshot.traces),
		scopes: snapshots.flatMap((snapshot) => snapshot.scopes),
		periods: snapshots.flatMap((snapshot) => snapshot.periods),
		intersections: snapshots.flatMap((snapshot) => snapshot.intersections),
		scopeSegments: snapshots.flatMap((snapshot) => snapshot.scopeSegments)
	};
	const roleById = new Map<string, string>();
	for (const [role, records] of snapshotRecords(merged)) {
		for (const record of records) {
			const existingRole = roleById.get(record.id);
			if (existingRole) {
				throw new Error(`Duplicate Explorer entity id ${record.id}: ${existingRole} and ${role}`);
			}
			roleById.set(record.id, role);
		}
	}
	return merged;
};
