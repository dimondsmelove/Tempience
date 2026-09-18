import { assertJsonObject, assertTraceFieldMetadata } from '../trace-kind-v-validation';
import type { JsonObject, TraceKind, TraceKindV } from '../types';

export const normalizeTraceKind = (value: Record<string, unknown>): TraceKind => ({
	id: String(value.id),
	name: String(value.name),
	currentKindVId: String(value.currentKindVId),
	createdAt: String(value.createdAt),
	updatedAt: String(value.updatedAt)
});

export const normalizeParentKindVIds = (value: unknown): string[] => {
	if (!Array.isArray(value)) throw new Error('Stored TraceKindV parentKindVIds must be an array');
	const parentKindVIds = value.map((parentKindVId) => {
		if (typeof parentKindVId !== 'string' || parentKindVId.length === 0) {
			throw new Error('TraceKindV parentKindVIds must contain non-empty strings');
		}
		return parentKindVId;
	});
	if (new Set(parentKindVIds).size !== parentKindVIds.length) {
		throw new Error('TraceKindV parentKindVIds must be unique');
	}
	return parentKindVIds.toSorted();
};

export const normalizeTraceKindV = (value: Record<string, unknown>): TraceKindV => {
	assertJsonObject(value.dataSchema, 'Stored TraceKindV dataSchema');
	assertJsonObject(value.uiSchema ?? {}, 'Stored TraceKindV uiSchema');
	assertTraceFieldMetadata(value.fieldMeta ?? {}, value.dataSchema);
	const generation = Number(value.generation);
	if (!Number.isInteger(generation) || generation < 1) {
		throw new Error('Stored TraceKindV generation must be a positive integer');
	}
	return {
		id: String(value.id),
		kindId: String(value.kindId),
		generation,
		parentKindVIds: normalizeParentKindVIds(value.parentKindVIds),
		dataSchema: value.dataSchema,
		uiSchema: (value.uiSchema ?? {}) as JsonObject,
		fieldMeta: (value.fieldMeta ?? {}) as NonNullable<TraceKindV['fieldMeta']>,
		createdAt: String(value.createdAt),
		createdByDeviceId: String(value.createdByDeviceId)
	};
};

export const compareTraceKindVersions = (left: TraceKindV, right: TraceKindV): number =>
	left.generation - right.generation ||
	left.createdAt.localeCompare(right.createdAt) ||
	left.id.localeCompare(right.id);

export const findTraceKindVersionHeads = (kindVersions: TraceKindV[]): TraceKindV[] => {
	const kindVIds = new Set(kindVersions.map((kindV) => kindV.id));
	const referencedKindVIds = new Set(
		kindVersions.flatMap((kindV) =>
			kindV.parentKindVIds.filter((parentKindVId) => kindVIds.has(parentKindVId))
		)
	);
	return kindVersions
		.filter((kindV) => !referencedKindVIds.has(kindV.id))
		.toSorted(compareTraceKindVersions);
};
