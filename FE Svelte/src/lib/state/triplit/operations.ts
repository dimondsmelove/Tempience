import type { LogAction } from './types';

type PatchValue = unknown;

export type FieldPatch = {
	before: PatchValue;
	after: PatchValue;
};

export type FieldPatches = Record<string, FieldPatch>;

export const buildFieldPatches = (
	before: Record<string, PatchValue>,
	after: Record<string, PatchValue>,
	fields: readonly string[]
): FieldPatches => {
	const patches: FieldPatches = {};

	for (const field of fields) {
		if (!Object.is(before[field], after[field])) {
			patches[field] = { before: before[field] ?? null, after: after[field] ?? null };
		}
	}

	return patches;
};

export const logActionForDeleted = (isDeleted: boolean): LogAction =>
	isDeleted ? 'deleted' : 'restored';

export const serializePatches = (patches: FieldPatches): string => JSON.stringify(patches);
