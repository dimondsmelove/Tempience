import { createFormValidator, addFormComponents } from '@sjsf/ajv8-validator';
import { theme } from '@sjsf/basic-theme';
import Checkboxes from '@sjsf/basic-theme/extra-widgets/checkboxes.svelte';
import Textarea from '@sjsf/basic-theme/extra-widgets/textarea.svelte';
import type { Schema, ValidatorFactoryOptions } from '@sjsf/form';
import EnumField from '@sjsf/form/fields/extra/enum.svelte';
import MultiEnumField from '@sjsf/form/fields/extra/multi-enum.svelte';
import { extendByRecord, overrideByRecord } from '@sjsf/form/lib/resolver';
import { createFormMerger } from '@sjsf/form/mergers/modern';
import { t } from '$lib/state/Locale/Locale.svelte';
import type { JsonObject, TraceKindV, TraceKindVDraft } from '$lib/state/triplit/types';
import { CodedError } from '$lib/model/Errors/CodedError';
import DateTimeInput from './DateTimeInput.svelte';
import ValidationErrors from './ValidationErrors.svelte';
import { localizeValidation } from './validation';
import {
	createTraceAjv,
	isJsonObject,
	schemaFieldAtPointer
} from '$lib/state/triplit/trace-kind-v-validation';

export const formValidator = (options: ValidatorFactoryOptions) =>
	createFormValidator<Record<string, unknown>>({
		...options,
		ajv: addFormComponents(createTraceAjv()),
		localize: localizeValidation
	});

/** The one SJSF theme of typed fields: basic widgets plus the shared date/time and text inputs. */
export const formTheme = overrideByRecord(
	extendByRecord(theme, {
		enumField: EnumField,
		multiEnumField: MultiEnumField,
		checkboxesWidget: Checkboxes,
		textareaWidget: Textarea,
		dateTimeWidget: DateTimeInput
	}),
	{ textWidget: DateTimeInput, errorsList: ValidationErrors }
);

/**
 * The default data of a fresh typed input, merged by the SJSF merger exactly as a form
 * created from `initialValue` would; a bound value receives no defaults on its own.
 */
export const schemaDefaults = (version: Pick<TraceKindV, 'dataSchema'>): JsonObject => {
	const schema = version.dataSchema as Schema;
	// The validator reads the merger lazily, after both exist, exactly as createForm wires them.
	const validator = formValidator({
		schema,
		uiSchema: {},
		uiOptionsRegistry: {},
		merger: () => merger
	});
	const merger = createFormMerger({ validator, schema });
	const merged = merger.mergeFormDataAndSchemaDefaults({ formData: {}, schema });
	return isJsonObject(merged) ? merged : {};
};

export function formUiSchema(definition: TraceKindVDraft): JsonObject {
	const ui = structuredClone(definition.uiSchema ?? {});
	ui['ui:options'] = { ...((ui['ui:options'] as JsonObject) ?? {}), hideTitle: true };
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
