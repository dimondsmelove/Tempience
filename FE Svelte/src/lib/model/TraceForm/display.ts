import { dateTimeFormat, numberFormat } from '$lib/state/Locale/format';
import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { JsonObject, JsonValue, TraceKindVDraft } from '$lib/state/triplit/types';
import { createTraceAjv, isJsonObject } from '$lib/state/triplit/trace-kind-v-validation';
import { pointerKey } from './schema';
import { summaryLeaves, type SummaryLeaf } from './summary-fields';

const ajv = createTraceAjv();
const temporalFormats = {
	date: ajv.compile({ type: 'string', format: 'date' }),
	'date-time': ajv.compile({ type: 'string', format: 'date-time' })
};

function formatFormDate(
	value: string,
	format: keyof typeof temporalFormats,
	language: Locale
): string {
	// Form fields follow JSON Schema formats, not the narrower Trace aboutTime contract.
	if (!temporalFormats[format](value)) return value;
	const date = new Date(value);
	// Retain imported values and valid RFC 3339 leap seconds that Date cannot represent.
	if (!Number.isFinite(date.getTime())) return value;
	return dateTimeFormat(
		language,
		format === 'date'
			? { dateStyle: 'medium', timeZone: 'UTC' }
			: { dateStyle: 'medium', timeStyle: 'short' }
	).format(date);
}

/**
 * A stored value as the language writes it: numbers and dates through the formatter cache
 * (one formatter per language and options, never one per row), yes/no through the catalog,
 * a choice by its own title, a unit as the user named it.
 */
export function formatFormValue(
	value: JsonValue | undefined,
	schema: JsonObject,
	unit?: string,
	language: Locale = 'ru'
): string {
	if (value === undefined || value === null) return '—';
	if (Array.isArray(value))
		return value
			.map((item) =>
				formatFormValue(item, isJsonObject(schema.items) ? schema.items : {}, undefined, language)
			)
			.join(', ');
	if (isJsonObject(value))
		return Object.entries(value)
			.map(([key, item]) => {
				const node =
					isJsonObject(schema.properties) && isJsonObject(schema.properties[key])
						? schema.properties[key]
						: {};
				return `${node.title ?? key}: ${formatFormValue(item, node, undefined, language)}`;
			})
			.join('; ');
	if (typeof value === 'boolean')
		return value ? translate(language, 'common.yes') : translate(language, 'common.no');
	if (typeof value === 'number')
		return `${numberFormat(language).format(value)}${unit ? ` ${unit}` : ''}`;
	if (Array.isArray(schema.oneOf)) {
		const option = schema.oneOf.find((entry) => isJsonObject(entry) && entry.const === value);
		if (isJsonObject(option) && typeof option.title === 'string') return option.title;
	}
	if (schema.format === 'date' || schema.format === 'date-time')
		return formatFormDate(value, schema.format, language);
	return value;
}

const valueAt = (data: JsonObject, path: readonly string[]): JsonValue | undefined => {
	let current: JsonValue | undefined = data;
	for (const key of path) {
		if (!isJsonObject(current)) return undefined;
		current = current[key];
	}
	return current;
};

/**
 * How a typed record reads: its Kind's own values, and the label of the Kind itself. A
 * schema may carry its own title; a legal one without it is named by the Kind, which is
 * why the caller passes that name. `displayFields` are every value the record holds, for
 * the Context; `conciseFields` and the title are the row summary — the summary leaves of
 * the version that the record has values for — which a thin read of exactly those leaves
 * shows the same way. Nothing here is stored back into the record.
 */
/** The summary leaves of a version, read from its schema once per version object. */
const leavesByVersion = new WeakMap<TraceKindVDraft, readonly SummaryLeaf[]>();
const leavesOf = (definition: TraceKindVDraft): readonly SummaryLeaf[] => {
	let leaves = leavesByVersion.get(definition);
	if (!leaves) leavesByVersion.set(definition, (leaves = summaryLeaves(definition)));
	return leaves;
};

export function traceFormDisplay(
	definition: TraceKindVDraft,
	data: JsonObject,
	kindName?: string,
	language: Locale = 'ru'
) {
	const fields: { label: string; value: string }[] = [];
	function visit(
		node: JsonObject,
		value: JsonObject,
		pointer: string,
		labels: string[],
		ui: JsonObject
	) {
		if (!isJsonObject(node.properties)) return;
		const order =
			isJsonObject(ui['ui:options']) && Array.isArray(ui['ui:options'].order)
				? ui['ui:options'].order.filter((key): key is string => typeof key === 'string')
				: [];
		for (const key of new Set([...order, ...Object.keys(node.properties)])) {
			const field = node.properties[key];
			if (!isJsonObject(field) || value[key] === undefined) continue;
			const path = `${pointer}/properties/${pointerKey(key)}`;
			const label = [...labels, String(field.title ?? key)];
			const item = value[key];
			const fieldUi = isJsonObject(ui[key]) ? ui[key] : {};
			if (isJsonObject(item) && field.type === 'object') visit(field, item, path, label, fieldUi);
			else if (Array.isArray(item) && isJsonObject(field.items) && field.items.type === 'object') {
				item.forEach((entry, index) => {
					if (isJsonObject(entry))
						visit(
							field.items as JsonObject,
							entry,
							`${path}/items`,
							[...label, String(index + 1)],
							isJsonObject(fieldUi.items) ? fieldUi.items : {}
						);
				});
			} else
				fields.push({
					label: label.join(' / '),
					value: formatFormValue(item, field, definition.fieldMeta?.[path]?.unit?.label, language)
				});
		}
	}
	visit(definition.dataSchema, data, '', [], definition.uiSchema ?? {});
	const kindLabel = String(
		definition.dataSchema.title ?? kindName ?? translate(language, 'trace.record')
	);
	const conciseFields = leavesOf(definition).flatMap((leaf) => {
		const value = valueAt(data, leaf.path);
		return value === undefined || value === null
			? []
			: [{ label: leaf.label, value: formatFormValue(value, leaf.schema, leaf.unit, language) }];
	});
	const displayTitle = [
		kindLabel,
		...conciseFields.map((field) => `${field.label}: ${field.value}`)
	].join(' · ');
	return { displayTitle, displayFields: fields, conciseFields, kindLabel };
}
