import Ajv, { type ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import type { JsonObject, JsonValue, TraceFieldMetadata, TraceKindVDraft } from './types';

export const createTraceAjv = () =>
	addFormats(new Ajv({ allErrors: true, strict: true, multipleOfPrecision: 8 }));

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
};

const isJsonValue = (value: unknown, ancestors: Set<object>): value is JsonValue => {
	if (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'boolean' ||
		(typeof value === 'number' && Number.isFinite(value))
	) {
		return true;
	}
	if (typeof value !== 'object' || value === null || ancestors.has(value)) return false;

	ancestors.add(value);
	const valid = Array.isArray(value)
		? value.every((item) => isJsonValue(item, ancestors))
		: isPlainObject(value) && Object.values(value).every((item) => isJsonValue(item, ancestors));
	ancestors.delete(value);
	return valid;
};

export const isJsonObject = (value: unknown): value is JsonObject =>
	isPlainObject(value) && isJsonValue(value, new Set());

export function assertJsonObject(value: unknown, label: string): asserts value is JsonObject {
	if (!isJsonObject(value)) throw new Error(`${label} must be a JSON object`);
}

const formatErrors = (errors: ErrorObject[] | null | undefined): string =>
	errors
		?.map((error) => `${error.instancePath || '/'} ${error.message ?? error.keyword}`)
		.join('; ') ?? 'unknown validation error';

const compileSchema = (dataSchema: JsonObject) => {
	try {
		return createTraceAjv().compile(dataSchema);
	} catch (cause: unknown) {
		throw new Error(
			`Invalid TraceKindV dataSchema: ${cause instanceof Error ? cause.message : String(cause)}`,
			{ cause }
		);
	}
};

export function assertTraceKindVSchema(dataSchema: unknown): asserts dataSchema is JsonObject {
	assertJsonObject(dataSchema, 'TraceKindV dataSchema');
	if (dataSchema.type !== 'object') {
		throw new Error('TraceKindV dataSchema must declare an object root');
	}
	compileSchema(dataSchema);
}

export const schemaFieldAtPointer = (schema: JsonObject, pointer: string): JsonObject | null => {
	if (!pointer.startsWith('/properties/')) return null;
	let node: unknown = schema;
	for (const part of pointer.slice(1).split('/')) {
		const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
		if (!isJsonObject(node) || !Object.hasOwn(node, key)) return null;
		node = node[key];
	}
	return isJsonObject(node) ? node : null;
};

export function assertTraceFormDefinition(draft: TraceKindVDraft): void {
	assertTraceKindVSchema(draft.dataSchema);
	assertJsonObject(draft.uiSchema ?? {}, 'TraceKindV uiSchema');
	assertTraceFieldMetadata(draft.fieldMeta ?? {}, draft.dataSchema);
}

export function assertTraceFieldMetadata(
	value: unknown,
	schema: JsonObject
): asserts value is TraceFieldMetadata {
	assertJsonObject(value, 'TraceKindV fieldMeta');
	for (const [pointer, metadata] of Object.entries(value)) {
		const field = schemaFieldAtPointer(schema, pointer);
		if (!field || !isJsonObject(metadata) || Object.keys(metadata).some((key) => key !== 'unit'))
			throw new Error(`Invalid field metadata: ${pointer}`);
		if (metadata.unit === undefined) continue;
		const unit = metadata.unit;
		if (
			!['number', 'integer'].includes(String(field.type)) ||
			!isJsonObject(unit) ||
			typeof unit.id !== 'string' ||
			!unit.id.trim() ||
			typeof unit.label !== 'string' ||
			!unit.label.trim()
		)
			throw new Error(`Invalid measurement unit: ${pointer}`);
	}
}

export function assertTraceData(data: unknown, dataSchema: JsonObject): asserts data is JsonObject {
	assertJsonObject(data, 'Typed Trace data');
	const validate = compileSchema(dataSchema);
	if (!validate(data)) {
		throw new Error(`Trace data does not match TraceKindV: ${formatErrors(validate.errors)}`);
	}
}
