import type { JsonObject, TraceFieldMetadata, TraceKindVDraft } from '$lib/state/triplit/types';
import type { TraceDatasetColumn, TraceDatasetRepeat } from '$lib/state/triplit/trace-dataset';
export type TraceScalarFieldKind =
	| 'text'
	| 'textarea'
	| 'number'
	| 'integer'
	| 'boolean'
	| 'date'
	| 'datetime'
	| 'choice'
	| 'multi-choice';
export type TraceChoiceDraft = { id: string; key?: string; label: string };
type FieldBase = {
	id: string;
	key?: string;
	label: string;
	required: boolean;
	help?: string;
	original?: JsonObject;
	locked?: boolean;
};
export type TraceScalarFieldDraft = FieldBase & {
	kind: TraceScalarFieldKind;
	unit: string;
	unitId?: string;
	options: TraceChoiceDraft[];
	minimum?: number;
	maximum?: number;
	minLength?: number;
	maxLength?: number;
	initial?: boolean;
};
export type TraceRepeatingFieldDraft = FieldBase & {
	kind: 'repeating';
	fields: TraceFieldDraft[];
	minItems?: number;
	maxItems?: number;
};
export type TraceGroupFieldDraft = FieldBase & { kind: 'group'; fields: TraceFieldDraft[] };
export type TraceFieldDraft =
	TraceScalarFieldDraft | TraceRepeatingFieldDraft | TraceGroupFieldDraft;
export type TraceFormDraft = {
	name: string;
	fields: TraceFieldDraft[];
	original?: TraceKindVDraft;
};
export type TraceSchemaProjectionColumn = {
	label: string;
	column: TraceDatasetColumn;
	valueLabels?: Record<string, string>;
};
export type TraceSchemaProjection = {
	id: string;
	title: string;
	repeat?: TraceDatasetRepeat;
	columns: TraceSchemaProjectionColumn[];
};
export type CompiledForm = {
	dataSchema: JsonObject;
	uiSchema: JsonObject;
	fieldMeta: TraceFieldMetadata;
};
