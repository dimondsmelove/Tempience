import { pathKey } from './helpers';
import type {
	DataRequirement,
	KindIndexRequest,
	TraceDatasetDataFilter,
	TraceDatasetRequest,
	TraceDatasetValueType
} from './types';

const assertPath = (path: readonly string[], label: string): void => {
	if (path.length === 0) throw new Error(`${label} must not be empty`);
	for (const segment of path) {
		if (segment.length === 0 || segment.includes('.')) {
			throw new Error(`${label} contains an unsupported segment: ${JSON.stringify(segment)}`);
		}
	}
};

export const isValueOfType = (value: unknown, expectedType: TraceDatasetValueType): boolean =>
	expectedType === 'string[]'
		? Array.isArray(value) && value.every((item) => typeof item === 'string')
		: typeof value === expectedType && (expectedType !== 'number' || Number.isFinite(value));

const validateFilter = (filter: TraceDatasetDataFilter): void => {
	assertPath(filter.path, 'Trace dataset filter path');
	if (filter.operator === 'in' || filter.operator === 'nin') {
		if (!Array.isArray(filter.value) || filter.value.length === 0) {
			throw new Error(`${filter.operator} filter requires a non-empty value array`);
		}
		if (!filter.value.every((value) => isValueOfType(value, filter.expectedType))) {
			throw new Error(`Filter values at ${pathKey(filter.path)} do not match the expected type`);
		}
		return;
	}
	if (filter.operator === 'isDefined') {
		if (typeof filter.value !== 'boolean') {
			throw new Error('isDefined filter requires a boolean value');
		}
		return;
	}
	if (
		(filter.operator === 'like' || filter.operator === 'nlike') &&
		filter.expectedType !== 'string'
	) {
		throw new Error(`${filter.operator} filter requires expectedType string`);
	}
	if (!isValueOfType(filter.value, filter.expectedType)) {
		throw new Error(`Filter value at ${pathKey(filter.path)} does not match the expected type`);
	}
};

const validateRestriction = (request: KindIndexRequest): void => {
	if (request.kindId.trim().length === 0) {
		throw new Error('Trace dataset kindId is required');
	}
	if (request.scope && request.scope.id.trim().length === 0) {
		throw new Error('Trace dataset scope id is required');
	}
	if (request.scope && request.scope.mode !== 'direct' && request.scope.mode !== 'subtree') {
		throw new Error('Trace dataset scope mode must be direct or subtree');
	}
	for (const filter of request.filters ?? []) validateFilter(filter);
};

export const validateIndexRequest = (request: KindIndexRequest): void => {
	validateRestriction(request);
	const requirements = new Map<string, TraceDatasetValueType>();
	for (const filter of request.filters ?? []) {
		const key = pathKey(filter.path);
		const existing = requirements.get(key);
		if (existing && existing !== filter.expectedType) {
			throw new Error(`Conflicting expected types for Trace data field ${key}`);
		}
		requirements.set(key, filter.expectedType);
	}
};

export const validateRequest = (request: TraceDatasetRequest): void => {
	validateRestriction(request);
	if (request.kindVId !== undefined && request.kindVId.trim().length === 0) {
		throw new Error('Trace dataset kindVId must name a version');
	}
	if (request.repeat) assertPath(request.repeat.path, 'Trace dataset repeat path');
	if (request.columns.length === 0) throw new Error('Trace dataset requires at least one column');

	const columnKeys = new Set<string>();
	for (const column of request.columns) {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(column.key)) {
			throw new Error(`Invalid Trace dataset column key: ${JSON.stringify(column.key)}`);
		}
		if (columnKeys.has(column.key)) {
			throw new Error(`Duplicate Trace dataset column key: ${column.key}`);
		}
		columnKeys.add(column.key);
		if (column.source !== 'core') {
			assertPath(column.path, `Trace dataset column ${column.key}`);
		}
		if (column.source === 'item' && !request.repeat) {
			throw new Error(`Trace dataset item column ${column.key} requires repeat`);
		}
	}
	if (request.repeat && !request.columns.some((column) => column.source === 'item')) {
		throw new Error('Trace dataset repeat requires at least one item column');
	}

	const requirements = new Map<string, TraceDatasetValueType>();
	for (const requirement of dataRequirements(request)) {
		const key = `${requirement.source}:${pathKey(requirement.path)}`;
		const existing = requirements.get(key);
		if (existing && existing !== requirement.expectedType) {
			throw new Error(`Conflicting expected types for Trace ${requirement.source} field ${key}`);
		}
		requirements.set(key, requirement.expectedType);
	}

	if (request.time) {
		const from = request.time.from ? Date.parse(request.time.from) : null;
		const to = request.time.to ? Date.parse(request.time.to) : null;
		if (from === null && to === null) {
			throw new Error('Trace dataset time range requires from or to');
		}
		if (from !== null && !Number.isFinite(from)) throw new Error('Invalid Trace dataset time.from');
		if (to !== null && !Number.isFinite(to)) throw new Error('Invalid Trace dataset time.to');
		if (from !== null && to !== null && from > to) {
			throw new Error('Trace dataset time.from must not be after time.to');
		}
	}

	if (request.limit !== undefined && (!Number.isInteger(request.limit) || request.limit <= 0)) {
		throw new Error('Trace dataset limit must be a positive integer');
	}
};

export const dataRequirements = (request: TraceDatasetRequest): DataRequirement[] => {
	const requirements: DataRequirement[] = [];
	for (const column of request.columns) {
		if (column.source !== 'core') {
			requirements.push({
				source: column.source,
				path: column.path,
				expectedType: column.expectedType
			});
		}
	}
	for (const filter of request.filters ?? []) {
		requirements.push({ source: 'data', path: filter.path, expectedType: filter.expectedType });
	}
	return requirements;
};
