import type { JsonObject, TraceKindVDraft } from '$lib/state/triplit/types';
import { isJsonObject } from '$lib/state/triplit/trace-kind-v-validation';
import { pointerKey } from './schema';

/** One leaf of a Kind version's schema that a row summary may show. */
export type SummaryLeaf = Readonly<{
	/** The key path into the record's data, as a selection names it. */
	path: readonly string[];
	/** The JSON pointer into the schema, as the field metadata names it. */
	pointer: string;
	label: string;
	schema: JsonObject;
	unit?: string;
}>;

/** How many own values a row summary carries; the Context shows the rest. */
export const SUMMARY_LEAVES = 2;

const orderedKeys = (node: JsonObject, ui: JsonObject): string[] => {
	const order =
		isJsonObject(ui['ui:options']) && Array.isArray(ui['ui:options'].order)
			? ui['ui:options'].order.filter((key): key is string => typeof key === 'string')
			: [];
	return [
		...new Set([...order, ...Object.keys(isJsonObject(node.properties) ? node.properties : {})])
	];
};

/** A multi-line text field: the form shows it as a textarea, and no row has room for it. */
export const isMultilineLeaf = (ui: JsonObject): boolean =>
	isJsonObject(ui['ui:components']) && ui['ui:components'].textWidget === 'textareaWidget';

/**
 * The leaves a row summary is made of: the first `SUMMARY_LEAVES` scalar fields of the schema
 * in its own order — the form's order where it names one — descending into groups, skipping
 * repeated items, whose values are per item, and multi-line text, which no row shows. The
 * rule is static: the same leaves whatever a record holds, so a thin read of exactly these
 * leaves shows a record the way its full read does.
 */
export const summaryLeaves = (definition: TraceKindVDraft): SummaryLeaf[] => {
	const leaves: SummaryLeaf[] = [];
	const visit = (
		node: JsonObject,
		ui: JsonObject,
		path: string[],
		pointer: string,
		labels: string[]
	) => {
		if (!isJsonObject(node.properties)) return;
		for (const key of orderedKeys(node, ui)) {
			if (leaves.length >= SUMMARY_LEAVES) return;
			const field = node.properties[key];
			if (!isJsonObject(field)) continue;
			const fieldUi = isJsonObject(ui[key]) ? ui[key] : {};
			const fieldPointer = `${pointer}/properties/${pointerKey(key)}`;
			const label = [...labels, String(field.title ?? key)];
			if (field.type === 'object') {
				visit(field, fieldUi, [...path, key], fieldPointer, label);
				continue;
			}
			if (field.type === 'array' && isJsonObject(field.items) && field.items.type === 'object')
				continue;
			if (isMultilineLeaf(fieldUi)) continue;
			leaves.push({
				path: [...path, key],
				pointer: fieldPointer,
				label: label.join(' / '),
				schema: field,
				unit: definition.fieldMeta?.[fieldPointer]?.unit?.label
			});
		}
	};
	visit(definition.dataSchema, definition.uiSchema ?? {}, [], '', []);
	return leaves;
};

/** The summary leaves of one version, as a thin read of its records selects them. */
export type VersionSummary = Readonly<{
	kindVId: string;
	paths: readonly (readonly string[])[];
}>;

/**
 * The data paths a thin read selects, per version: a record's summary is its own version's,
 * so the paths of one schema are never read through the rows of another — where the same
 * key is nested, nullable, or a multi-line text no row shows.
 */
export const versionSummaries = (
	versions: readonly (TraceKindVDraft & { id: string })[]
): VersionSummary[] =>
	versions.map((version) => ({
		kindVId: version.id,
		paths: summaryLeaves(version).map((leaf) => leaf.path)
	}));
