import { isJsonObject } from '$lib/state/triplit/trace-kind-v-validation';

/**
 * A list whose row is one value — the sets of an exercise, each only its repetitions — shows
 * its values in a line (loop 013, Q7); a row of several fields, or of a nested list, is a card.
 */
export function inlineItems(schema: unknown): boolean {
	if (!isJsonObject(schema) || schema.type !== 'array' || !isJsonObject(schema.items)) return false;
	const properties = schema.items.properties;
	// A row with conditions draws more fields than its own properties: always a card.
	if (schema.items.allOf !== undefined) return false;
	if (schema.items.type !== 'object' || !isJsonObject(properties)) return false;
	const fields = Object.values(properties);
	return (
		fields.length === 1 &&
		isJsonObject(fields[0]) &&
		fields[0].type !== 'object' &&
		fields[0].type !== 'array'
	);
}

/** A list whose rows are variants, as the form draws it: the choice and its options. */
export type ListVariants = Readonly<{
	key: string;
	/** What a variant is called: «Упражнение». */
	title: string;
	options: readonly Readonly<{ value: string; title: string }>[];
}>;

/**
 * The variants of a list in the form's schema, where a row keeps only its choice and every
 * other field waits in a branch of it (`formSchema`); null for any other list.
 */
export function listVariants(schema: unknown): ListVariants | null {
	if (!isJsonObject(schema) || !isJsonObject(schema.items)) return null;
	const { properties, allOf } = schema.items;
	if (!isJsonObject(properties) || !Array.isArray(allOf) || !allOf.length) return null;
	const keys = Object.keys(properties);
	const choice = properties[keys[0]];
	if (keys.length !== 1 || !isJsonObject(choice) || !Array.isArray(choice.oneOf)) return null;
	return {
		key: keys[0],
		title: typeof choice.title === 'string' ? choice.title : keys[0],
		options: choice.oneOf.filter(isJsonObject).map((option) => ({
			value: String(option.const),
			title: typeof option.title === 'string' ? option.title : String(option.const)
		}))
	};
}

/**
 * The name of the one field of a list whose values stand in a line — «Длительность, мин» — as
 * the form titles it (its unit included), so the line never shows bare numbers.
 */
export function inlineFieldTitle(schema: unknown, uiSchema: unknown): string | null {
	if (!inlineItems(schema) || !isJsonObject(schema) || !isJsonObject(schema.items)) return null;
	const properties = schema.items.properties;
	if (!isJsonObject(properties)) return null;
	const [key] = Object.keys(properties);
	const field = properties[key];
	const rowUi = isJsonObject(uiSchema) && isJsonObject(uiSchema.items) ? uiSchema.items : {};
	const fieldUi = isJsonObject(rowUi[key]) ? rowUi[key] : {};
	const title = isJsonObject(fieldUi['ui:options']) ? fieldUi['ui:options'].title : undefined;
	if (typeof title === 'string') return title;
	return isJsonObject(field) && typeof field.title === 'string' ? field.title : key;
}

/** At most this many simple fields fit a row laid out as a line of columns (weight, reps, effort, rest). */
const COMPACT_FIELDS = 4;

/**
 * The column titles of a list whose rows are two or three simple values — a set of weight and
 * repetitions, a purchase of item and price — laid out as a line each (research 2026-09-29:
 * sets as a table, Hevy/Strong); null for any other list. Titles carry their units.
 */
export function compactColumns(schema: unknown, uiSchema: unknown): string[] | null {
	if (!isJsonObject(schema) || !isJsonObject(schema.items)) return null;
	const { properties, allOf, type } = schema.items;
	if (type !== 'object' || allOf !== undefined || !isJsonObject(properties)) return null;
	const keys = Object.keys(properties);
	if (keys.length < 2 || keys.length > COMPACT_FIELDS) return null;
	const rowUi = isJsonObject(uiSchema) && isJsonObject(uiSchema.items) ? uiSchema.items : {};
	const titles: string[] = [];
	for (const key of keys) {
		const field = properties[key];
		const fieldUi = isJsonObject(rowUi[key]) ? rowUi[key] : {};
		if (!isJsonObject(field) || !['string', 'number', 'integer'].includes(String(field.type)))
			return null;
		if (isJsonObject(fieldUi['ui:components']) && fieldUi['ui:components'].textWidget) return null;
		const title = isJsonObject(fieldUi['ui:options']) ? fieldUi['ui:options'].title : undefined;
		titles.push(
			typeof title === 'string' ? title : typeof field.title === 'string' ? field.title : key
		);
	}
	return titles;
}
