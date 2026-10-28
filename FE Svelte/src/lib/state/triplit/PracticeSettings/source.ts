import { CodedError } from '$lib/model/Errors/CodedError';
import { summaryLeaves } from '$lib/model/TraceForm/summary-fields';
import type { TraceKindV } from '../types';
import type { PracticeSource } from './types';

export const practiceFields = (version: TraceKindV) =>
	summaryLeaves(version, Infinity).filter(
		(leaf) => leaf.schema.type === 'number' || leaf.schema.type === 'integer'
	);

export const samePath = (left: readonly string[], right: readonly string[]): boolean =>
	left.length === right.length && left.every((key, index) => key === right[index]);

export const parsePracticeSource = (input: unknown): PracticeSource => {
	const row = input as Record<string, unknown> | null;
	const strings = (value: unknown): value is string[] =>
		Array.isArray(value) &&
		value.length > 0 &&
		value.every((item) => typeof item === 'string' && item.length > 0);
	if (
		!row ||
		typeof row !== 'object' ||
		Array.isArray(row) ||
		row.id !== 'source' ||
		typeof row.kindId !== 'string' ||
		!row.kindId ||
		!strings(row.path) ||
		!strings(row.scopeIds) ||
		Object.keys(row).some((key) => !['id', 'kindId', 'path', 'scopeIds'].includes(key))
	)
		throw new CodedError('practice_source_format', 'The practice source has an invalid format');
	return {
		id: 'source',
		kindId: row.kindId,
		path: [...row.path],
		scopeIds: [...new Set(row.scopeIds)]
	};
};
