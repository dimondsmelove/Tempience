import { CodedError } from '$lib/model/Errors/CodedError';
import type { JsonObject, TraceFieldMetadata, TraceKindVDraft } from '$lib/state/triplit/types';
import { assertTraceFormDefinition } from '$lib/state/triplit/trace-kind-v-validation';
import { requiredLabel, uniqueMachineKey } from './keys';
import { compileScalarField } from './scalar';
import { conditionSchemas, type FieldCondition } from './conditions';
import { expandVariants } from './variants';
import { UNIT_IDS } from './constants';
import type { CompiledForm, TraceFieldDraft, TraceFormDraft, TraceScalarFieldDraft } from './types';

export const pointerKey = (key: string): string => key.replace(/~/g, '~0').replace(/\//g, '~1');

/**
 * The conditions of one level: every option of a choice field that names fields beside it shows
 * those and hides the others that any option of the same field names (loop 013, Q5). A field is
 * decided by one choice field at most; names of fields that are gone are ignored.
 */
function compileConditions(
	choices: readonly { field: TraceScalarFieldDraft; node: JsonObject; key: string }[],
	keyOf: ReadonlyMap<string, string>
): FieldCondition[] {
	const decidedBy = new Map<string, string>();
	return choices.flatMap(({ field, node, key }) => {
		const shows = field.options.map((option) =>
			(option.shows ?? [])
				.map((id) => keyOf.get(id))
				.filter((shown): shown is string => shown !== undefined && shown !== key)
		);
		const controlled = [...new Set(shows.flat())];
		if (!controlled.length) return [];
		for (const shown of controlled) {
			if (decidedBy.has(shown) && decidedBy.get(shown) !== key)
				throw new CodedError('form_condition_conflict', 'a field is shown by one choice field', {
					field: field.label
				});
			decidedBy.set(shown, key);
		}
		const values = (node.oneOf as JsonObject[]).map((option) => String(option.const));
		return field.options.map((_, index) => ({
			controller: key,
			value: values[index],
			shown: shows[index],
			hidden: controlled.filter((shown) => !shows[index].includes(shown)),
			required: []
		}));
	});
}

export function compileTraceForm(given: TraceFormDraft): CompiledForm {
	// A list of variants is compiled as the list with conditions it is stored as.
	const draft = { ...given, fields: expandVariants(given.fields) };
	const metadata: TraceFieldMetadata = {};
	const compileFields = (
		fields: TraceFieldDraft[],
		pointer: string,
		original: JsonObject = {},
		originalUi: JsonObject = {}
	): { schema: JsonObject; ui: JsonObject } => {
		if (!fields.length)
			throw new CodedError('form_fields_empty', 'a form or group needs at least one field');
		const properties: JsonObject = {};
		const required: string[] = [];
		const used = new Set<string>();
		const ui: JsonObject = { ...originalUi };
		const keyOf = new Map<string, string>();
		/** Choice fields with their compiled nodes: an option's stored value is its `const`. */
		const choices: { field: TraceScalarFieldDraft; node: JsonObject; key: string }[] = [];
		for (const field of fields) {
			if (field.kind === 'variants')
				throw new CodedError(
					'form_unsupported',
					'a list of variants is expanded before compiling',
					{
						label: field.label
					}
				);
			const label = requiredLabel(field.label, 'field');
			const key = field.key ?? uniqueMachineKey(label, used, 'field');
			if (field.key && used.has(key))
				throw new CodedError('form_keys_duplicate', 'field keys must differ', { key });
			used.add(key);
			keyOf.set(field.id, key);
			const path = `${pointer}/properties/${pointerKey(key)}`;
			const previousUi = (originalUi[key] ?? {}) as JsonObject;
			let node: JsonObject = { ...field.original, title: label };
			if (field.help?.trim()) node.description = field.help.trim();
			else delete node.description;
			if (field.kind === 'group' || field.kind === 'repeating') {
				const repeating = field.kind === 'repeating';
				const child = compileFields(
					field.fields,
					repeating ? `${path}/items` : path,
					(repeating ? field.original?.items : field.original) as JsonObject | undefined,
					(repeating ? previousUi.items : previousUi) as JsonObject | undefined
				);
				if (repeating) {
					node = { ...node, type: 'array', items: child.schema };
					if (field.minItems !== undefined || field.required) node.minItems = field.minItems ?? 1;
					else delete node.minItems;
					if (field.maxItems !== undefined) node.maxItems = field.maxItems;
					else delete node.maxItems;
					ui[key] = { ...previousUi, items: child.ui };
				} else {
					node = { ...child.schema, ...node, type: 'object', properties: child.schema.properties };
					if (child.schema.required) node.required = child.schema.required;
					else delete node.required;
					ui[key] = child.ui;
				}
			} else {
				const scalar = compileScalarField(field, node, previousUi);
				node = scalar.node;
				if (field.kind === 'choice') choices.push({ field, node, key });
				ui[key] = scalar.ui;
				if (field.unit.trim())
					metadata[path] = {
						unit: {
							id:
								field.unitId ??
								UNIT_IDS[field.unit.trim().toLowerCase()] ??
								`custom:${field.unit.trim().toLowerCase()}`,
							label: field.unit.trim()
						}
					};
			}
			properties[key] = node;
			if (field.required) required.push(key);
		}
		const conditions = compileConditions(choices, keyOf);
		const controlled = new Set(
			conditions.flatMap((condition) => [...condition.shown, ...condition.hidden])
		);
		// A controlled field is required only while shown; the choice that decides is always.
		const baseRequired = [
			...new Set([
				...required.filter((key) => !controlled.has(key)),
				...conditions.map((condition) => condition.controller)
			])
		];
		const schema: JsonObject = {
			...(Object.keys(original).length ? original : { additionalProperties: false }),
			type: 'object',
			properties
		};
		if (baseRequired.length) schema.required = baseRequired;
		else delete schema.required;
		if (conditions.length)
			schema.allOf = conditionSchemas(
				conditions.map((condition) => ({
					...condition,
					required: condition.shown.filter((key) => required.includes(key))
				}))
			);
		else delete schema.allOf;
		for (const key of Object.keys(originalUi))
			if (!key.startsWith('ui:') && !Object.hasOwn(properties, key)) delete ui[key];
		ui['ui:options'] = {
			...((ui['ui:options'] as JsonObject) ?? {}),
			order: Object.keys(properties)
		};
		return { schema, ui };
	};
	const root = compileFields(
		draft.fields,
		'',
		draft.original?.dataSchema,
		draft.original?.uiSchema
	);
	// The template a Kind was made from stays with its layout, never with its data.
	const rootOptions: JsonObject = { ...((root.ui['ui:options'] as JsonObject) ?? {}) };
	if (draft.template)
		rootOptions.template = structuredClone(draft.template) as unknown as JsonObject;
	else delete rootOptions.template;
	root.ui['ui:options'] = rootOptions;
	root.schema.title = requiredLabel(draft.name, 'kind');
	if (!draft.original) root.schema.$schema = 'http://json-schema.org/draft-07/schema#';
	const result = { dataSchema: root.schema, uiSchema: root.ui, fieldMeta: metadata };
	assertTraceFormDefinition(result);
	return result;
}

export const compileTraceDataSchema = (
	name: string,
	fields: readonly TraceFieldDraft[]
): JsonObject => compileTraceForm({ name, fields: [...fields] }).dataSchema;

export function assertFieldEvolution(before: TraceKindVDraft, after: TraceKindVDraft): void {
	const check = (oldNode: JsonObject, newNode: JsonObject, pointer: string) => {
		if (oldNode.type !== newNode.type || oldNode.format !== newNode.format)
			throw new CodedError('form_type_changed', 'a published field keeps its type', { pointer });
		const oldUnit = before.fieldMeta?.[pointer]?.unit?.id;
		const newUnit = after.fieldMeta?.[pointer]?.unit?.id;
		if (oldUnit !== newUnit)
			throw new CodedError('form_unit_changed', 'a published field keeps its unit', { pointer });
		const oldProperties = oldNode.properties as JsonObject | undefined;
		const newProperties = newNode.properties as JsonObject | undefined;
		for (const key of Object.keys(oldProperties ?? {})) {
			if (newProperties?.[key])
				check(
					oldProperties![key] as JsonObject,
					newProperties[key] as JsonObject,
					`${pointer}/properties/${pointerKey(key)}`
				);
		}
		if (oldNode.items && newNode.items)
			check(oldNode.items as JsonObject, newNode.items as JsonObject, `${pointer}/items`);
	};
	check(before.dataSchema, after.dataSchema, '');
}
