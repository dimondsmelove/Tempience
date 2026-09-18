import { translate } from '$lib/state/Locale/messages';
import type { Locale } from '$lib/state/Locale/types';
import type { JsonObject } from '$lib/state/triplit/types';
import type { TraceDatasetValueType } from '$lib/state/triplit/trace-dataset';
import type { TraceSchemaProjection, TraceSchemaProjectionColumn } from './types';
const jsonObject = (value: unknown): JsonObject | null =>
	value !== null && typeof value === 'object' && !Array.isArray(value)
		? (value as JsonObject)
		: null;

const schemaTitle = (node: JsonObject, fallback: string): string =>
	typeof node.title === 'string' && node.title.trim().length > 0 ? node.title : fallback;

const scalarType = (node: JsonObject): TraceDatasetValueType | null => {
	if (node.type === 'array' && jsonObject(node.items)?.type === 'string') return 'string[]';
	if (node.type === 'string' || node.type === 'boolean') return node.type;
	if (node.type === 'number' || node.type === 'integer') return 'number';
	return null;
};

const choiceValueLabels = (node: JsonObject): Record<string, string> | undefined => {
	if (!Array.isArray(node.oneOf)) return undefined;
	const labels: Record<string, string> = {};
	for (const value of node.oneOf) {
		const option = jsonObject(value);
		if (!option || typeof option.const !== 'string' || typeof option.title !== 'string') continue;
		labels[option.const] = option.title;
	}
	return Object.keys(labels).length > 0 ? labels : undefined;
};

const scalarColumns = (
	properties: JsonObject,
	source: 'data' | 'item',
	prefix: string,
	path: string[] = [],
	labels: string[] = []
): TraceSchemaProjectionColumn[] => {
	const columns: TraceSchemaProjectionColumn[] = [];
	for (const [propertyKey, value] of Object.entries(properties)) {
		const node = jsonObject(value);
		if (!node) continue;
		const label = [...labels, schemaTitle(node, propertyKey)];
		const fieldPath = [...path, propertyKey];
		if (node.type === 'object' && jsonObject(node.properties)) {
			columns.push(
				...scalarColumns(
					node.properties as JsonObject,
					source,
					`${prefix}_${columns.length}`,
					fieldPath,
					label
				)
			);
			continue;
		}
		const expectedType = scalarType(node);
		if (!expectedType) continue;
		const valueLabels = choiceValueLabels(
			expectedType === 'string[]' ? (node.items as JsonObject) : node
		);
		columns.push({
			label: label.join(' / '),
			...(valueLabels ? { valueLabels } : {}),
			column: {
				key: `${prefix}_${columns.length}`,
				source,
				path: fieldPath,
				expectedType
			}
		});
	}
	return columns;
};

export const traceSchemaProjections = (
	schema: JsonObject,
	language: Locale = 'ru'
): TraceSchemaProjection[] => {
	const properties = jsonObject(schema.properties);
	if (!properties) return [];

	const coreColumn: TraceSchemaProjectionColumn = {
		label: translate(language, 'kindHistory.dateTime'),
		column: { key: 'about_at', source: 'core', field: 'aboutAt' }
	};
	const rootColumns = scalarColumns(properties, 'data', 'root');
	const repeated: TraceSchemaProjection[] = [];

	const visitRepeats = (properties: JsonObject, path: string[] = [], labels: string[] = []) => {
		for (const [propertyKey, value] of Object.entries(properties)) {
			const node = jsonObject(value);
			if (!node) continue;
			const fieldPath = [...path, propertyKey];
			const fieldLabels = [...labels, schemaTitle(node, propertyKey)];
			if (node.type === 'object' && jsonObject(node.properties))
				visitRepeats(node.properties as JsonObject, fieldPath, fieldLabels);
			if (node.type !== 'array') continue;
			const items = jsonObject(node.items);
			const itemProperties = items ? jsonObject(items.properties) : null;
			if (!items || items.type !== 'object' || !itemProperties) continue;
			const itemColumns = scalarColumns(itemProperties, 'item', `item_${repeated.length}`);
			if (itemColumns.length > 0)
				repeated.push({
					id: `repeat:${fieldPath.join('/')}`,
					title: fieldLabels.join(' / '),
					repeat: { path: fieldPath },
					columns: [coreColumn, ...rootColumns, ...itemColumns]
				});
			visitRepeats(itemProperties, [...fieldPath, '[]'], fieldLabels);
		}
	};
	visitRepeats(properties);

	if (repeated.length > 0) return repeated;
	if (rootColumns.length === 0) return [];
	return [
		{
			id: 'trace',
			title: translate(language, 'kindHistory.recordsProjection'),
			columns: [coreColumn, ...rootColumns]
		}
	];
};
