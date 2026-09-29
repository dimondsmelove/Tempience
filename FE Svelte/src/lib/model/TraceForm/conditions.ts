import { isJsonObject } from '$lib/state/triplit/trace-kind-v-validation';
import type { JsonObject } from '$lib/state/triplit/types';

/**
 * One option of a choice field and what it does to the fields beside it (loop 013, Q4/Q5):
 * «Бег» shows «Время» and «Дистанция» and hides «Подходы». A field no option names is not
 * controlled and is always shown.
 */
export type FieldCondition = Readonly<{
	/** The key of the choice field that decides. */
	controller: string;
	/** The option's stored value. */
	value: string;
	/** Controlled keys this option shows. */
	shown: readonly string[];
	/** Controlled keys this option hides: they hold no value while it is chosen. */
	hidden: readonly string[];
	/** Shown keys the record must fill while this option is chosen. */
	required: readonly string[];
}>;

/**
 * The stored shape: every field stays in `properties`, so every reader of the data finds it;
 * each option is one `if/then` that marks a controlled field `true` (shown) or `false` (hidden,
 * no value allowed). `true` also satisfies strict Ajv, which wants a required key defined next
 * to `required`; both branches name their type, since the form compiles each on its own.
 */
export function conditionSchemas(conditions: readonly FieldCondition[]): JsonObject[] {
	return conditions.map(({ controller, value, shown, hidden, required }) => {
		const then: JsonObject = {
			type: 'object',
			properties: Object.fromEntries([
				...shown.map((key) => [key, true]),
				...hidden.map((key) => [key, false])
			])
		};
		if (required.length) then.required = [...required];
		return {
			if: {
				type: 'object',
				properties: { [controller]: { const: value } },
				required: [controller]
			},
			then
		};
	});
}

const strings = (value: unknown): value is string[] =>
	Array.isArray(value) && value.every((entry) => typeof entry === 'string');
const onlyKeys = (value: JsonObject, allowed: readonly string[]): boolean =>
	Object.keys(value).every((key) => allowed.includes(key));

/** One `allOf` entry read back, or null when it is not the shape `conditionSchemas` writes. */
function readCondition(entry: unknown): FieldCondition | null {
	if (!isJsonObject(entry) || !onlyKeys(entry, ['if', 'then'])) return null;
	const { if: when, then } = entry;
	if (!isJsonObject(when) || !isJsonObject(then)) return null;
	if (!onlyKeys(when, ['type', 'properties', 'required']) || when.type !== 'object') return null;
	if (!onlyKeys(then, ['type', 'properties', 'required']) || then.type !== 'object') return null;
	if (!isJsonObject(when.properties)) return null;
	const [controller, ...more] = Object.keys(when.properties);
	const test = when.properties[controller];
	if (controller === undefined || more.length || !isJsonObject(test) || !onlyKeys(test, ['const']))
		return null;
	if (typeof test.const !== 'string' || !strings(when.required)) return null;
	if (when.required.length !== 1 || when.required[0] !== controller) return null;
	if (!isJsonObject(then.properties)) return null;
	const marks = Object.entries(then.properties);
	if (!marks.every(([, mark]) => typeof mark === 'boolean')) return null;
	const shown = marks.filter(([, mark]) => mark === true).map(([key]) => key);
	const required = then.required ?? [];
	if (!strings(required) || !required.every((key) => shown.includes(key))) return null;
	return {
		controller,
		value: test.const,
		shown,
		hidden: marks.filter(([, mark]) => mark === false).map(([key]) => key),
		required
	};
}

/** The conditions of an object node: none without `allOf`, null when its `allOf` is foreign. */
export function readConditions(node: JsonObject): FieldCondition[] | null {
	if (node.allOf === undefined) return [];
	if (!Array.isArray(node.allOf)) return null;
	const conditions = node.allOf.map(readCondition);
	return conditions.every((condition) => condition !== null)
		? (conditions as FieldCondition[])
		: null;
}

export const controlledKeys = (conditions: readonly FieldCondition[]): Set<string> =>
	new Set(conditions.flatMap((condition) => [...condition.shown, ...condition.hidden]));

/** The controlled keys a row hides for the options it has chosen; no choice shows none of them. */
export function hiddenKeys(conditions: readonly FieldCondition[], row: JsonObject): Set<string> {
	const shown = new Set(
		conditions
			.filter((condition) => row[condition.controller] === condition.value)
			.flatMap((condition) => condition.shown)
	);
	return new Set([...controlledKeys(conditions)].filter((key) => !shown.has(key)));
}

/**
 * The schema the form draws from: a controlled field moves into the `then` of the options that
 * show it, so the form shows it only for them. Without `additionalProperties: false` there,
 * which would count those fields as extra; the stored schema still forbids them, and a saved
 * record goes through `withoutHidden` first.
 */
export function formSchema(schema: JsonObject): JsonObject {
	const next: JsonObject = { ...schema };
	if (isJsonObject(schema.items)) {
		next.items = formSchema(schema.items);
		// Rows come only from their buttons (audit 2026-09-29): no empty row is made up to reach
		// the minimum; the saved record is still held to it by the stored schema.
		if (schema.items.type === 'object') delete next.minItems;
	}
	if (!isJsonObject(schema.properties)) return next;
	const properties = Object.fromEntries(
		Object.entries(schema.properties).map(([key, node]) => [
			key,
			isJsonObject(node) ? formSchema(node) : node
		])
	);
	next.properties = properties;
	const conditions = readConditions(schema);
	if (!conditions?.length) return next;
	const controlled = controlledKeys(conditions);
	next.properties = Object.fromEntries(
		Object.entries(properties).filter(([key]) => !controlled.has(key))
	);
	delete next.additionalProperties;
	next.allOf = conditions.map((condition) => {
		const then: JsonObject = {
			type: 'object',
			properties: Object.fromEntries(condition.shown.map((key) => [key, properties[key]]))
		};
		if (condition.required.length) then.required = [...condition.required];
		return {
			if: {
				type: 'object',
				properties: { [condition.controller]: { const: condition.value } },
				required: [condition.controller]
			},
			then
		};
	});
	return next;
}

/** The data as saved: what the chosen options hide is dropped, at every level (Q6). */
export function withoutHidden(schema: JsonObject, value: unknown): unknown {
	if (Array.isArray(value))
		return isJsonObject(schema.items)
			? value.map((item) => withoutHidden(schema.items as JsonObject, item))
			: value;
	if (!isJsonObject(value) || !isJsonObject(schema.properties)) return value;
	const properties = schema.properties;
	const hidden = hiddenKeys(readConditions(schema) ?? [], value);
	return Object.fromEntries(
		Object.entries(value)
			.filter(([key]) => !hidden.has(key))
			.map(([key, entry]) => [
				key,
				isJsonObject(properties[key]) ? withoutHidden(properties[key] as JsonObject, entry) : entry
			])
	);
}

/**
 * The choice of a row of variants (owner, 2026-09-29), in the stored schema: the row's first
 * field, deciding every other field of the row. Null for any other row.
 */
export function variantKey(row: JsonObject): string | null {
	const conditions = readConditions(row);
	if (!conditions?.length || !isJsonObject(row.properties)) return null;
	const controllers = new Set(conditions.map((condition) => condition.controller));
	const [first, ...rest] = Object.keys(row.properties);
	if (controllers.size !== 1 || !controllers.has(first)) return null;
	const controlled = controlledKeys(conditions);
	return rest.every((key) => controlled.has(key)) ? first : null;
}
