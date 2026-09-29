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
export type TraceChoiceDraft = {
	id: string;
	key?: string;
	label: string;
	/** Ids of the fields beside the choice that this option shows (loop 013, Q5). */
	shows?: string[];
};
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
/** One variant of a row: «Бег» with its own fields. */
export type TraceVariantDraft = {
	id: string;
	key?: string;
	label: string;
	fields: TraceFieldDraft[];
};
/**
 * A list whose every row is one of its variants, each with its own fields (owner, 2026-09-29):
 * stored as a list whose first field chooses the variant and whose other fields each belong to
 * one variant — the conditions of loop 013, never written by hand.
 */
export type TraceVariantsFieldDraft = FieldBase & {
	kind: 'variants';
	/** What a row's variant is called: «Упражнение». */
	choiceLabel: string;
	choiceId: string;
	choiceKey?: string;
	choiceOriginal?: JsonObject;
	variants: TraceVariantDraft[];
	minItems?: number;
	maxItems?: number;
};
export type TraceFieldDraft =
	TraceScalarFieldDraft | TraceRepeatingFieldDraft | TraceGroupFieldDraft | TraceVariantsFieldDraft;
/**
 * How a workout made from its template counts each exercise (owner, 2026-09-29): kept with the
 * Kind, so its template screen opens again, keyed by each variant's stable id.
 */
export type TraceWorkoutMeta = {
	id: 'workout';
	exercises: Record<string, { way: string; extras: string[] }>;
};
export type TraceFormDraft = {
	name: string;
	fields: TraceFieldDraft[];
	original?: TraceKindVDraft;
	template?: TraceWorkoutMeta;
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
