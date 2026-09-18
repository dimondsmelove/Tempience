import { locale } from '$lib/state/Locale/Locale.svelte';
import type {
	TraceDatasetColumn,
	TraceDatasetDataFilter,
	TraceDatasetFilterOperator,
	TraceDatasetRow
} from '$lib/state/triplit/trace-dataset';
import type { JsonObject, TraceKindV } from '$lib/state/triplit/types';
import type {
	TraceSchemaProjection,
	TraceSchemaProjectionColumn
} from '$lib/model/TraceForm/types';
import { pointerKey } from '$lib/model/TraceForm/schema';
import { isMultilineLeaf } from '$lib/model/TraceForm/summary-fields';
import { traceSchemaProjections } from '$lib/model/TraceForm/projections';
import { isJsonObject, schemaFieldAtPointer } from '$lib/state/triplit/trace-kind-v-validation';
import { formatFormValue } from '$lib/model/TraceForm/display';
import { formatTemporalValue } from '$lib/state/triplit/trace-time';
import type { FilterField } from './types';

function fieldPointer(
	projection: TraceSchemaProjection,
	field: TraceSchemaProjectionColumn
): string {
	if (field.column.source === 'core') return '';
	const path =
		field.column.source === 'item'
			? [...(projection.repeat?.path ?? []), '[]', ...field.column.path]
			: field.column.path;
	return path.map((key) => (key === '[]' ? '/items' : `/properties/${pointerKey(key)}`)).join('');
}

/** The form's own node for a data path: the ui schema mirrors the data keys. */
const uiNodeAt = (ui: JsonObject | undefined, path: readonly string[]): JsonObject => {
	let node: JsonObject = ui ?? {};
	for (const key of path) {
		const next = node[key];
		if (!isJsonObject(next)) return {};
		node = next;
	}
	return node;
};

/**
 * The columns a version's table shows until the user chooses: every scalar field but
 * multi-line text, which no row has room for and the Context shows whole. The date column
 * is the table's own and never a choice.
 */
export function defaultColumnKeys(
	projection: TraceSchemaProjection,
	version: TraceKindV
): string[] {
	return projection.columns
		.filter(
			(field) =>
				field.column.source === 'core' ||
				!isMultilineLeaf(uiNodeAt(version.uiSchema, field.column.path))
		)
		.map((field) => field.column.key);
}

/** The projection's columns as a page reads them: the date by its semantic value. */
export function columnsRequest(
	projection: TraceSchemaProjection,
	keys: readonly string[]
): TraceDatasetColumn[] {
	return projection.columns
		.filter((field) => keys.includes(field.column.key))
		.map(({ column }) =>
			column.source === 'core' && column.field === 'aboutAt'
				? { ...column, field: 'aboutDate' }
				: column
		);
}

/**
 * The fields a value filter may name: the scalar leaves of every version, by their stable
 * key, labelled as the newest version labels them. A key keeps its type across versions
 * (a changed type is a new field), so one filter reads the same in every table.
 */
export function filterFields(versions: readonly TraceKindV[]): FilterField[] {
	const fields = new Map<string, FilterField>();
	for (const version of versions.toSorted((a, b) => b.generation - a.generation)) {
		const projection = traceSchemaProjections(version.dataSchema, locale.current)[0];
		for (const field of projection?.columns ?? []) {
			const column = field.column;
			if (column.source !== 'data' || column.expectedType === 'string[]') continue;
			const key = column.path.join('.');
			if (fields.has(key)) continue;
			fields.set(key, {
				key,
				path: column.path,
				label: field.label,
				type: column.expectedType,
				choices: field.valueLabels
			});
		}
	}
	return [...fields.values()];
}

/** The conditions a field of this type offers; the first is the one offered first. */
export function filterOperators(
	field: FilterField | undefined
): readonly TraceDatasetFilterOperator[] {
	if (field?.type === 'number') return ['=', '!=', '>', '>=', '<', '<='];
	if (field?.type === 'string' && !field.choices) return ['like', '='];
	return ['='];
}

/**
 * The condition being composed as a filter, or null while it does not read as one: no value
 * yet, a number that is not one, a yes/no not chosen, a choice the field does not offer. What
 * the control shows is the only thing that applies; nothing is taken for false or for a
 * choice by default. Zero, an explicit «no» and every offered choice are values.
 */
export function composeFilter(
	field: FilterField | undefined,
	operator: TraceDatasetFilterOperator,
	value: string
): TraceDatasetDataFilter | null {
	if (!field) return null;
	if (field.type === 'number') {
		if (value.trim() === '') return null;
		const number = Number(value);
		if (!Number.isFinite(number)) return null;
		return { path: field.path, expectedType: 'number', operator, value: number };
	}
	if (field.type === 'boolean') {
		if (value !== 'true' && value !== 'false') return null;
		return { path: field.path, expectedType: 'boolean', operator: '=', value: value === 'true' };
	}
	if (field.choices) {
		if (!Object.hasOwn(field.choices, value)) return null;
		return { path: field.path, expectedType: 'string', operator: '=', value };
	}
	if (value.trim() === '') return null;
	return operator === 'like'
		? { path: field.path, expectedType: 'string', operator: 'like', value: `%${value.trim()}%` }
		: { path: field.path, expectedType: 'string', operator: '=', value: value.trim() };
}

/** What one value filter says, for the list of active filters. */
export function describeFilter(
	filter: TraceDatasetDataFilter,
	fields: readonly FilterField[],
	words: Readonly<{ yes: string; no: string }> = { yes: 'true', no: 'false' }
): string {
	const field = fields.find((entry) => entry.key === filter.path.join('.'));
	const label = field?.label ?? filter.path.join('.');
	const value =
		filter.expectedType === 'boolean'
			? filter.value
				? words.yes
				: words.no
			: filter.operator === 'like'
				? String(filter.value).replaceAll('%', '')
				: (field?.choices?.[String(filter.value)] ?? String(filter.value));
	const sign = filter.operator === 'like' ? '∋' : filter.operator === '!=' ? '≠' : filter.operator;
	return `${label} ${sign} ${value}`;
}

export function datasetCell(
	row: TraceDatasetRow,
	field: TraceSchemaProjectionColumn,
	projection: TraceSchemaProjection,
	versions: readonly TraceKindV[]
): string {
	const value = row.values[field.column.key];
	if (value == null) return '—';
	if (field.column.source === 'core') {
		if (typeof value !== 'string') return String(value);
		const precision =
			value.length === 4
				? 'year'
				: value.length === 7
					? 'month'
					: value.length === 10
						? 'day'
						: 'minute';
		return formatTemporalValue(value, precision, locale.current);
	}
	const version = versions.find((entry) => entry.id === row.kindVId);
	const pointer = fieldPointer(projection, field);
	const schema = version && schemaFieldAtPointer(version.dataSchema, pointer);
	return formatFormValue(
		Array.isArray(value) ? [...value] : (value as string | number | boolean),
		schema ?? {},
		version?.fieldMeta?.[pointer]?.unit?.label,
		locale.current
	);
}
