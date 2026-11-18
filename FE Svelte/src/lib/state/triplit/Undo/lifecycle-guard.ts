import type { Entity } from '../Repository/types';

export type LifecycleDependency = { id: string; fingerprint: string };

export type TraceLifecycleUndoGuard = {
	revisions: Record<string, string | null>;
	dependencies: {
		traces: LifecycleDependency[];
		intersections: LifecycleDependency[];
		assessments: LifecycleDependency[];
	};
};

const stableValue = (value: unknown): unknown => {
	if (Array.isArray(value)) return value.map(stableValue);
	if (value === null || typeof value !== 'object') return value;
	return Object.fromEntries(
		Object.entries(value as Record<string, unknown>)
			.toSorted(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => [key, stableValue(entry)])
	);
};

const fingerprint = (value: unknown): string => JSON.stringify(stableValue(value));

const relativeAnchor = (row: Entity): unknown => {
	const aboutTime = row.aboutTime;
	return aboutTime !== null && typeof aboutTime === 'object'
		? (aboutTime as Record<string, unknown>).anchorTraceId
		: null;
};

/** Captures only dependency fields that can change source eligibility or the referenced record. */
export const traceLifecycleDependencies = (
	traceId: string,
	traces: Entity[],
	intersections: Entity[],
	assessments: Entity[]
): TraceLifecycleUndoGuard['dependencies'] => ({
	traces: traces
		.filter(
			(row) =>
				row.id !== traceId && (row.aboutTraceId === traceId || relativeAnchor(row) === traceId)
		)
		.map((row) => ({
			id: row.id,
			fingerprint: fingerprint([row.aboutKind, row.aboutTraceId, row.aboutTime, row.isDeleted])
		}))
		.toSorted((left, right) => left.id.localeCompare(right.id)),
	intersections: intersections
		.filter((row) => row.fromId === traceId || row.toId === traceId)
		.map((row) => ({
			id: row.id,
			fingerprint: fingerprint([
				row.fromId,
				row.toId,
				row.kind,
				row.isDeleted,
				row.lifecycleId,
				row.activationId,
				row.assessmentId
			])
		}))
		.toSorted((left, right) => left.id.localeCompare(right.id)),
	assessments: assessments
		.filter((row) => {
			const origin = row.origin;
			return (
				origin !== null &&
				typeof origin === 'object' &&
				(origin as Record<string, unknown>).factId === traceId
			);
		})
		.map((row) => ({
			id: row.id,
			fingerprint: fingerprint([
				row.source,
				row.origin,
				row.initial,
				row.values,
				row.placement,
				row.isDeleted,
				row.lifecycleId
			])
		}))
		.toSorted((left, right) => left.id.localeCompare(right.id))
});
