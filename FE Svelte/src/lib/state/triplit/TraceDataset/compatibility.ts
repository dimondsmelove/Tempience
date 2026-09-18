import { isJsonObject } from '../trace-kind-v-validation';
import type { JsonObject } from '../types';
import { pathKey } from './helpers';
import { dataRequirements } from './request';
import type {
	DataRequirement,
	StoredTraceKindV,
	TraceDatasetCompatibilityIssue,
	TraceDatasetRepeat,
	TraceDatasetRequest,
	TraceDatasetValueType,
	UnknownRecord
} from './types';

export const normalizeKindVersions = (values: readonly unknown[]): StoredTraceKindV[] =>
	values.map((value) => {
		const record = value as UnknownRecord;
		return {
			id: String(record.id),
			generation: Number(record.generation),
			dataSchema: isJsonObject(record.dataSchema) ? record.dataSchema : null
		};
	});

const schemaNodeAtPath = (schema: JsonObject, path: readonly string[]): JsonObject | null => {
	let node = schema;
	for (const segment of path) {
		if (segment === '[]') {
			if (node.type !== 'array' || !isJsonObject(node.items)) return null;
			node = node.items;
			continue;
		}
		if (!isJsonObject(node.properties)) return null;
		const next = node.properties[segment];
		if (!isJsonObject(next)) return null;
		node = next;
	}
	return node;
};

const repeatedItemSchema = (schema: JsonObject, repeat: TraceDatasetRepeat): JsonObject | null => {
	const repeatNode = schemaNodeAtPath(schema, repeat.path);
	if (!repeatNode || repeatNode.type !== 'array' || !isJsonObject(repeatNode.items)) return null;
	return repeatNode.items.type === 'object' ? repeatNode.items : null;
};

const requirementPath = (request: TraceDatasetRequest, requirement: DataRequirement): string[] =>
	requirement.source === 'item' && request.repeat
		? [...request.repeat.path, '[]', ...requirement.path]
		: [...requirement.path];

const declaredTypes = (node: JsonObject): string[] | null => {
	if (node.type === 'array' && isJsonObject(node.items) && node.items.type === 'string')
		return ['string[]'];
	if (typeof node.type === 'string') return [node.type];
	if (Array.isArray(node.type) && node.type.every((value) => typeof value === 'string')) {
		return [...node.type];
	}
	return null;
};

const isCompatibleType = (
	actualTypes: readonly string[],
	expectedType: TraceDatasetValueType
): boolean =>
	actualTypes.length === 1 &&
	(actualTypes[0] === expectedType || (expectedType === 'number' && actualTypes[0] === 'integer'));

export const traceDatasetCompatibilityIssues = (
	kindVersions: readonly StoredTraceKindV[],
	request: TraceDatasetRequest
): TraceDatasetCompatibilityIssue[] => {
	const requirements = new Map<string, DataRequirement>();
	for (const requirement of dataRequirements(request)) {
		requirements.set(
			`${requirement.source}:${pathKey(requirement.path)}:${requirement.expectedType}`,
			requirement
		);
	}

	const issues: TraceDatasetCompatibilityIssue[] = [];
	for (const kindV of kindVersions) {
		for (const requirement of requirements.values()) {
			const reportedPath = requirementPath(request, requirement);
			if (!kindV.dataSchema) {
				issues.push({
					kindVId: kindV.id,
					generation: kindV.generation,
					path: reportedPath,
					expectedType: requirement.expectedType,
					actualType: null,
					reason: 'unsupported_schema'
				});
				continue;
			}
			const baseSchema =
				requirement.source === 'item' && request.repeat
					? repeatedItemSchema(kindV.dataSchema, request.repeat)
					: kindV.dataSchema;
			const node = baseSchema ? schemaNodeAtPath(baseSchema, requirement.path) : null;
			// A field added in a later version has no value in earlier traces.
			if (!node) continue;
			const types = declaredTypes(node);
			if (!types || !isCompatibleType(types, requirement.expectedType)) {
				issues.push({
					kindVId: kindV.id,
					generation: kindV.generation,
					path: reportedPath,
					expectedType: requirement.expectedType,
					actualType: types?.join(' | ') ?? null,
					reason: types ? 'type_mismatch' : 'unsupported_schema'
				});
			}
		}
	}
	return issues.toSorted(
		(left, right) =>
			left.generation - right.generation ||
			left.kindVId.localeCompare(right.kindVId) ||
			pathKey(left.path).localeCompare(pathKey(right.path))
	);
};
