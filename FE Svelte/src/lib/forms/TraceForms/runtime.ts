import { createFormValidator, addFormComponents } from '@sjsf/ajv8-validator';
import { theme } from '@sjsf/basic-theme';
import Textarea from '@sjsf/basic-theme/extra-widgets/textarea.svelte';
import type { Schema, ValidatorFactoryOptions } from '@sjsf/form';
import EnumField from '@sjsf/form/fields/extra/enum.svelte';
import MultiEnumField from '@sjsf/form/fields/extra/multi-enum.svelte';
import { extendByRecord, overrideByRecord } from '@sjsf/form/lib/resolver';
import { createFormMerger, type FormMergerOptions } from '@sjsf/form/mergers/modern';
import { t } from '$lib/state/Locale/Locale.svelte';
import type { JsonObject, TraceKindV, TraceKindVDraft } from '$lib/state/triplit/types';
import { CodedError } from '$lib/model/Errors/CodedError';
import { formSchema, variantKey } from '$lib/model/TraceForm/conditions';
import ChoicesWidget from './ChoicesWidget/ChoicesWidget.svelte';
import DateTimeInput from './DateTimeInput.svelte';
import ListItemTemplate from './List/ListItemTemplate.svelte';
import ListTemplate from './List/ListTemplate.svelte';
import ValidationErrors from './ValidationErrors.svelte';
import { localizeValidation } from './validation';
import {
	createTraceAjv,
	isJsonObject,
	schemaFieldAtPointer
} from '$lib/state/triplit/trace-kind-v-validation';

/**
 * The one merger of typed forms: a choice's first option is never taken as its default (audit
 * 2026-09-29) — a record says «Хорошо» only when the user picked it.
 */
export const formMerger = (options: FormMergerOptions) =>
	createFormMerger({ ...options, constAsDefaults: 'skipOneOf' });

export const formValidator = (options: ValidatorFactoryOptions) =>
	createFormValidator<Record<string, unknown>>({
		...options,
		ajv: addFormComponents(createTraceAjv()),
		localize: localizeValidation
	});

/** The one SJSF theme of typed fields: basic widgets plus the shared date/time, text and choice inputs. */
export const formTheme = overrideByRecord(
	extendByRecord(theme, {
		enumField: EnumField,
		multiEnumField: MultiEnumField,
		checkboxesWidget: ChoicesWidget,
		textareaWidget: Textarea,
		dateTimeWidget: DateTimeInput
	}),
	{
		textWidget: DateTimeInput,
		errorsList: ValidationErrors,
		arrayTemplate: ListTemplate,
		arrayItemTemplate: ListItemTemplate
	}
);

/**
 * The default data of a fresh typed input, merged by the SJSF merger exactly as a form
 * created from `initialValue` would; a bound value receives no defaults on its own.
 */
export const schemaDefaults = (version: Pick<TraceKindV, 'dataSchema'>): JsonObject => {
	// The defaults of the schema the form draws from: no row of variants is made up.
	const schema = formSchema(version.dataSchema) as Schema;
	// The validator reads the merger lazily, after both exist, exactly as createForm wires them.
	const validator = formValidator({
		schema,
		uiSchema: {},
		uiOptionsRegistry: {},
		merger: () => merger
	});
	const merger = formMerger({ validator, schema });
	const merged = merger.mergeFormDataAndSchemaDefaults({ formData: {}, schema });
	return isJsonObject(merged) ? merged : {};
};

/** A list row is not titled «Упражнения-1»: the list template numbers its rows itself. */
function untitleRows(schema: JsonObject, ui: JsonObject): void {
	if (!isJsonObject(schema.properties)) return;
	for (const [key, node] of Object.entries(schema.properties)) {
		if (!isJsonObject(node)) continue;
		if (!isJsonObject(ui[key])) ui[key] = {};
		const fieldUi = ui[key] as JsonObject;
		// A single choice starts empty (audit 2026-09-29): no first option taken in silence.
		if (node.type === 'string' && Array.isArray(node.oneOf))
			fieldUi['ui:options'] = {
				...((fieldUi['ui:options'] as JsonObject) ?? {}),
				clearable: true,
				select: { placeholder: t('choices.pick') }
			};
		if (node.type === 'object') untitleRows(node, fieldUi);
		if (node.type !== 'array' || !isJsonObject(node.items) || node.items.type !== 'object')
			continue;
		if (!isJsonObject(fieldUi.items)) fieldUi.items = {};
		const rowUi = fieldUi.items as JsonObject;
		rowUi['ui:options'] = { ...((rowUi['ui:options'] as JsonObject) ?? {}), hideTitle: true };
		// A row of variants is titled by its variant, chosen by the button that added it: the
		// choice itself is not drawn again inside the row.
		const choice = variantKey(node.items);
		if (choice) {
			if (!isJsonObject(rowUi[choice])) rowUi[choice] = {};
			const choiceUi = rowUi[choice] as JsonObject;
			choiceUi['ui:options'] = {
				...((choiceUi['ui:options'] as JsonObject) ?? {}),
				layout: { hidden: true }
			};
		}
		untitleRows(node.items, rowUi);
	}
}

export function formUiSchema(definition: TraceKindVDraft): JsonObject {
	const ui = structuredClone(definition.uiSchema ?? {});
	ui['ui:options'] = { ...((ui['ui:options'] as JsonObject) ?? {}), hideTitle: true };
	untitleRows(definition.dataSchema, ui);
	for (const [pointer, meta] of Object.entries(definition.fieldMeta ?? {})) {
		if (!meta.unit) continue;
		const field = schemaFieldAtPointer(definition.dataSchema, pointer);
		if (!field)
			throw new CodedError('form_unit_field', 'fieldMeta names a field the schema lacks', {
				pointer
			});
		const parts = pointer.slice(1).split('/');
		let current = ui;
		for (let index = 0; index < parts.length; index++) {
			if (parts[index] === 'properties') index++;
			const key = parts[index].replace(/~1/g, '/').replace(/~0/g, '~');
			if (!Object.hasOwn(current, key) || !isJsonObject(current[key])) current[key] = {};
			current = current[key] as JsonObject;
		}
		const unit = meta.unit.label;
		const title = typeof field.title === 'string' ? field.title : null;
		current['ui:options'] = {
			...((current['ui:options'] as JsonObject) ?? {}),
			// The unit is the user's; only a title-less field is named by the interface, and that
			// name is read when the form renders the title, so it follows the language while the
			// uiSchema object stays the same: no validator, merger or value is created again.
			get title(): string {
				return `${title ?? t('form.value')}, ${unit}`;
			}
		};
	}
	return ui;
}
