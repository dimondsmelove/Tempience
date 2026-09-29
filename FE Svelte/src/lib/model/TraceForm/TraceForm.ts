import { CodedError } from '$lib/model/Errors/CodedError';
import { createId } from '$lib/state/triplit/ids';
import { isJsonObject } from '$lib/state/triplit/trace-kind-v-validation';
import type { JsonObject, TraceKindVDraft } from '$lib/state/triplit/types';
import { pointerKey } from './schema';
import { readConditions } from './conditions';
import { collapseVariants } from './variants';
import type {
	TraceChoiceDraft,
	TraceFieldDraft,
	TraceFormDraft,
	TraceVariantDraft,
	TraceWorkoutMeta
} from './types';
export * from './types';
export * from './schema';
export * from './keys';
export * from './projections';
export * from './conditions';
export * from './variants';

const newKey = (prefix: string) => `${prefix}_${createId().replace(/-/g, '')}`;
export const newChoice = (label = ''): TraceChoiceDraft => {
	const key = newKey('option');
	return { id: key, key, label };
};

/** A new variant of a row, without fields yet. */
export const newVariant = (label = ''): TraceVariantDraft => {
	const key = newKey('option');
	return { id: key, key, label, fields: [] };
};

export function newTraceField(kind: TraceFieldDraft['kind'] = 'text'): TraceFieldDraft {
	const key = newKey('field');
	const base = { id: key, key, kind, label: '', required: true };
	if (kind === 'group' || kind === 'repeating') return { ...base, kind, fields: [newTraceField()] };
	if (kind === 'variants') {
		const choiceKey = newKey('field');
		return {
			...base,
			kind,
			choiceLabel: '',
			choiceId: choiceKey,
			choiceKey,
			variants: [newVariant()]
		};
	}
	return {
		...base,
		kind,
		unit: '',
		options: kind === 'choice' || kind === 'multi-choice' ? [newChoice(), newChoice()] : []
	};
}

const object = (value: unknown): JsonObject => (isJsonObject(value) ? value : {});
const unsupported = (label: string): never => {
	throw new CodedError('form_unsupported', `the builder does not support the schema «${label}»`, {
		label
	});
};

export function decodeTraceForm(name: string, definition: TraceKindVDraft): TraceFormDraft {
	const decodeFields = (schema: JsonObject, ui: JsonObject, pointer: string): TraceFieldDraft[] => {
		if (schema.type !== 'object' || !isJsonObject(schema.properties)) unsupported(name);
		// Conditions of the level are the one `allOf` the builder reads; any other is foreign.
		const conditions = readConditions(schema) ?? unsupported(name);
		const level = { ...schema };
		delete level.allOf;
		assertSupported(level, name);
		const properties = schema.properties as JsonObject;
		const required = [
			...(Array.isArray(schema.required) ? schema.required : []),
			...conditions.flatMap((condition) => condition.required)
		];
		const idOf = (key: string) => `${pointer}/properties/${pointerKey(key)}`;
		/** An option with the fields it shows, when the choice decides any. */
		const withShows = (key: string, option: TraceChoiceDraft): TraceChoiceDraft => {
			const shown = conditions
				.filter((condition) => condition.controller === key && condition.value === option.key)
				.flatMap((condition) => condition.shown);
			return conditions.some((condition) => condition.controller === key)
				? { ...option, shows: shown.map(idOf) }
				: option;
		};
		const configuredOrder = object(ui['ui:options']).order;
		const order = Array.isArray(configuredOrder)
			? configuredOrder.filter(
					(key): key is string => typeof key === 'string' && Object.hasOwn(properties, key)
				)
			: [];
		const keys = [...new Set([...order, ...Object.keys(properties)])];
		return keys.map((key) => {
			if (!isJsonObject(properties[key])) unsupported(key);
			const node = properties[key] as JsonObject;
			const label = typeof node.title === 'string' ? node.title : key;
			assertSupported(node, label);
			const fieldUi = object(ui[key]);
			const path = `${pointer}/properties/${pointerKey(key)}`;
			const base = {
				id: path,
				key,
				label,
				required: required.includes(key),
				help: typeof node.description === 'string' ? node.description : '',
				original: structuredClone(node),
				locked: true
			};
			if (node.type === 'object')
				return { ...base, kind: 'group', fields: decodeFields(node, fieldUi, path) };
			if (node.type === 'array' && object(node.items).type === 'object')
				return {
					...base,
					kind: 'repeating',
					fields: decodeFields(object(node.items), object(fieldUi.items), `${path}/items`),
					minItems: typeof node.minItems === 'number' ? node.minItems : undefined,
					maxItems: typeof node.maxItems === 'number' ? node.maxItems : undefined
				};
			const choiceNode = node.type === 'array' ? object(node.items) : node;
			const options = readOptions(choiceNode);
			let kind: Exclude<TraceFieldDraft['kind'], 'group' | 'repeating'>;
			if (options) kind = node.type === 'array' ? 'multi-choice' : 'choice';
			else if (node.type === 'number' || node.type === 'integer' || node.type === 'boolean')
				kind = node.type;
			else if (node.type === 'string') {
				if (node.format && !['date', 'date-time'].includes(String(node.format))) unsupported(label);
				kind =
					node.format === 'date'
						? 'date'
						: node.format === 'date-time'
							? 'datetime'
							: object(fieldUi['ui:components']).textWidget === 'textareaWidget'
								? 'textarea'
								: 'text';
			} else return unsupported(label);
			const unit = definition.fieldMeta?.[path]?.unit;
			return {
				...base,
				kind,
				unit: unit?.label ?? '',
				unitId: unit?.id,
				options: (options ?? []).map((option) => withShows(key, option)),
				minimum: typeof node.minimum === 'number' ? node.minimum : undefined,
				maximum: typeof node.maximum === 'number' ? node.maximum : undefined,
				minLength: typeof node.minLength === 'number' ? node.minLength : undefined,
				maxLength: typeof node.maxLength === 'number' ? node.maxLength : undefined,
				initial: typeof node.default === 'boolean' ? node.default : undefined
			};
		});
	};
	return {
		name,
		fields: collapseVariants(decodeFields(definition.dataSchema, definition.uiSchema ?? {}, '')),
		original: structuredClone(definition),
		...workoutMetaOf(definition)
	};
}

function assertSupported(schema: JsonObject, label: string): void {
	if (
		[
			'$ref',
			'allOf',
			'anyOf',
			'if',
			'then',
			'else',
			'not',
			'patternProperties',
			'dependencies',
			'additionalItems',
			'contains'
		].some((key) => Object.hasOwn(schema, key))
	)
		unsupported(label);
	if (schema.additionalProperties !== undefined && schema.additionalProperties !== false)
		unsupported(label);
	if (schema.oneOf && !readOptions(schema)) unsupported(label);
	if (
		schema.type === 'array' &&
		schema.uniqueItems !== true &&
		object(schema.items).type !== 'object'
	)
		unsupported(label);
}

function readOptions(node: JsonObject): TraceChoiceDraft[] | null {
	if (Array.isArray(node.enum)) {
		if (!node.enum.every((value) => typeof value === 'string')) return null;
		return node.enum.map((value) => ({
			id: String(value),
			key: String(value),
			label: String(value)
		}));
	}
	if (!Array.isArray(node.oneOf)) return null;
	if (
		!node.oneOf.every(
			(option) =>
				isJsonObject(option) &&
				typeof option.const === 'string' &&
				Object.keys(option).every((key) => ['const', 'title'].includes(key))
		)
	)
		return null;
	return node.oneOf.map((option) => {
		const item = option as JsonObject;
		return {
			id: String(item.const),
			key: String(item.const),
			label: String(item.title ?? item.const)
		};
	});
}

/** The workout template a version was made from, when its layout keeps one. */
function workoutMetaOf(definition: TraceKindVDraft): { template?: TraceWorkoutMeta } {
	const template = object(object(definition.uiSchema?.['ui:options']).template);
	if (template.id !== 'workout' || !isJsonObject(template.exercises)) return {};
	const exercises: TraceWorkoutMeta['exercises'] = {};
	for (const [id, entry] of Object.entries(template.exercises)) {
		if (!isJsonObject(entry) || typeof entry.way !== 'string') continue;
		const extras = Array.isArray(entry.extras)
			? entry.extras.filter((extra): extra is string => typeof extra === 'string')
			: [];
		exercises[id] = { way: entry.way, extras };
	}
	return { template: { id: 'workout', exercises } };
}
