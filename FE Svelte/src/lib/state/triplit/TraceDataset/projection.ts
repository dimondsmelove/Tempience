import { readSelectedTraceField } from '../Traces/json-encoding';
import { isJsonObject } from '../trace-kind-v-validation';
import type { JsonObject, JsonPrimitive } from '../types';
import { pathKey } from './helpers';
import { isValueOfType } from './request';
import type {
	TraceDatasetCell,
	TraceDatasetRequest,
	TraceDatasetRow,
	UnknownRecord
} from './types';

const getNestedValue = (value: unknown, path: readonly string[]): unknown => {
	let current = value;
	for (const segment of path) {
		if (current === null || typeof current !== 'object' || Array.isArray(current)) return undefined;
		current = (current as UnknownRecord)[segment];
	}
	return current;
};

const projectRow = (
	record: UnknownRecord,
	request: TraceDatasetRequest,
	traceId: string,
	item?: JsonObject,
	itemIndex?: number
): TraceDatasetRow => {
	const projected: Record<string, TraceDatasetCell> = {};
	for (const column of request.columns) {
		if (column.source === 'core') {
			const aboutTime =
				column.field === 'aboutDate' ? readSelectedTraceField(record, 'aboutTime') : undefined;
			const coreValue =
				column.field === 'aboutDate'
					? isJsonObject(aboutTime) && aboutTime.basis === 'absolute'
						? aboutTime.start
						: null
					: record[column.field];
			if (
				coreValue !== undefined &&
				coreValue !== null &&
				typeof coreValue !== 'string' &&
				typeof coreValue !== 'number' &&
				typeof coreValue !== 'boolean'
			) {
				throw new Error(`Trace ${traceId} has a non-scalar core field ${column.field}`);
			}
			projected[column.key] = (coreValue as JsonPrimitive | undefined) ?? null;
			continue;
		}

		const source = column.source === 'item' ? item : readSelectedTraceField(record, 'data');
		const dataValue = getNestedValue(source, column.path);
		if (dataValue === undefined) {
			projected[column.key] = null;
			continue;
		}
		if (!isValueOfType(dataValue, column.expectedType)) {
			const sourcePath =
				column.source === 'item' && request.repeat
					? [...request.repeat.path, '[]', ...column.path]
					: column.path;
			throw new Error(
				`Trace ${traceId} data.${pathKey(sourcePath)} does not match its projected type ${column.expectedType}`
			);
		}
		projected[column.key] = dataValue as TraceDatasetCell;
	}

	return {
		traceId,
		kindVId: String(record.kindVId),
		...(itemIndex === undefined ? {} : { itemIndex }),
		values: projected
	};
};

const repeatedValues = (value: unknown, path: readonly string[]): unknown[] => {
	if (value === undefined || value === null) return [];
	if (path.length === 0) {
		if (!Array.isArray(value)) throw new Error('Repeated data must be an array');
		return value;
	}
	const [head, ...tail] = path;
	if (head === '[]') {
		if (!Array.isArray(value)) throw new Error('Repeated parent data must be an array');
		return value.flatMap((item) => repeatedValues(item, tail));
	}
	return repeatedValues(getNestedValue(value, [head]), tail);
};

export const projectRows = (
	values: readonly unknown[],
	request: TraceDatasetRequest,
	knownKindVIds: ReadonlySet<string>
): TraceDatasetRow[] =>
	values.flatMap((value) => {
		const record = value as UnknownRecord;
		const traceId = String(record.id);
		if (typeof record.kindVId !== 'string' || !knownKindVIds.has(record.kindVId)) {
			throw new Error(`Trace ${traceId} references an unavailable TraceKindV`);
		}
		if (!request.repeat) return [projectRow(record, request, traceId)];

		const repeatedValue = repeatedValues(
			readSelectedTraceField(record, 'data'),
			request.repeat.path
		);
		// A record whose repeated group is empty or absent is still one row — its own values,
		// the item columns blank — so a history never loses a record for having no items.
		if (repeatedValue.length === 0) return [projectRow(record, request, traceId)];

		return repeatedValue.map((item, itemIndex) => {
			if (!isJsonObject(item)) {
				throw new Error(
					`Trace ${traceId} data.${pathKey(request.repeat?.path ?? [])}[${itemIndex}] must be an object`
				);
			}
			return projectRow(record, request, traceId, item, itemIndex);
		});
	});
