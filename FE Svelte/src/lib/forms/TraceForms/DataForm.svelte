<script lang="ts">
	import { untrack } from 'svelte';
	import {
		BasicForm,
		createForm,
		getValueSnapshot,
		sanitizeDataForNewSchema,
		type Schema,
		type UiSchemaRoot
	} from '@sjsf/form';
	import { createFormIdBuilder } from '@sjsf/form/id-builders/modern';
	import { createFormMerger } from '@sjsf/form/mergers/modern';
	import { resolver } from '@sjsf/form/resolvers/compat';
	import { errorText } from '$lib/state/Locale/errors';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { JsonObject, TraceKindVDraft } from '$lib/state/triplit/types';
	import { formTheme, formUiSchema, formValidator } from './runtime';
	import { formTranslation } from './validation';
	import type { DataFormProps } from './types';

	let {
		definition,
		initialValue = {},
		submitLabel,
		submitDisabled = false,
		label,
		onsubmit
	}: DataFormProps = $props();
	let busy = $state(false);
	/** The failure of the last submit, read in the language of the moment; 'invalid' for refused fields. */
	let failure = $state.raw<unknown>(null);
	const pinned = untrack(() => $state.snapshot(definition as unknown) as TraceKindVDraft);
	const uiSchema = formUiSchema(pinned);
	const uiOptions = uiSchema['ui:options'] as JsonObject;
	// Keep the schema identity stable so enabling submission never resets the field draft.
	uiSchema['ui:options'] = {
		...uiOptions,
		submitButton: {
			...(uiOptions.submitButton as JsonObject),
			get disabled() {
				return submitDisabled;
			}
		}
	};
	const form = createForm<Record<string, unknown>>({
		theme: formTheme,
		schema: pinned.dataSchema as Schema,
		uiSchema: uiSchema as UiSchemaRoot,
		initialValue: untrack(() => $state.snapshot(initialValue as unknown) as JsonObject),
		get translation() {
			return formTranslation(locale.current, submitLabel ?? t('form.submitRecord'));
		},
		resolver,
		merger: createFormMerger,
		validator: formValidator,
		idBuilder: createFormIdBuilder,
		onSubmit: async (value) => {
			if (busy || submitDisabled) return;
			busy = true;
			failure = null;
			try {
				await onsubmit(value as JsonObject);
			} catch (cause) {
				failure = cause ?? new Error();
			} finally {
				busy = false;
			}
		},
		onSubmitError: () => {
			failure = 'invalid';
		}
	});
	export function getDraft(schema: JsonObject): JsonObject {
		const data = sanitizeDataForNewSchema(
			form,
			schema as Schema,
			pinned.dataSchema as Schema,
			getValueSnapshot(form)
		);
		// SJSF marks removed properties as undefined; omit those keys before remounting.
		return JSON.parse(JSON.stringify(data)) as JsonObject;
	}
</script>

<div class="trace-data-form min-w-0" data-testid="typed-data-form">
	<fieldset disabled={busy} class="min-w-0 border-0 p-0">
		<BasicForm {form} aria-label={label ?? t('draft.typedFields')} novalidate />
	</fieldset>
	{#if failure !== null}<p role="alert" class="mt-2 text-sm text-[color:var(--cg-danger)]">
			{failure === 'invalid' ? t('draft.dataInvalid') : errorText(failure)}
		</p>{/if}
</div>

<style>
	.trace-data-form :global(form),
	.trace-data-form :global(.sjsf-object-property),
	.trace-data-form :global(.sjsf-field) {
		display: grid;
		gap: var(--cg-gap, 8px);
		min-width: 0;
	}
	.trace-data-form :global(label),
	.trace-data-form :global(legend) {
		font-size: 0.875rem;
	}
	.trace-data-form :global(input:not([type='checkbox']):not([type='radio'])),
	.trace-data-form :global(select),
	.trace-data-form :global(textarea) {
		width: 100%;
		min-width: 0;
		padding: var(--cg-control-padding-y, 6px) var(--cg-control-padding-x, 10px);
		color: var(--cg-text-primary);
		background: var(--cg-bg-raised);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	.trace-data-form :global(textarea) {
		min-height: 6rem;
	}
	.trace-data-form :global(button) {
		padding: var(--cg-control-padding-y, 6px) var(--cg-control-padding-x, 10px);
		color: var(--cg-text-primary);
		background: var(--cg-bg-raised);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
		cursor: pointer;
	}
	.trace-data-form :global(button:disabled) {
		opacity: 0.5;
		cursor: default;
	}
	.trace-data-form :global(button[type='submit']) {
		background: var(--cg-accent);
		color: var(--cg-text-on-accent);
		margin-top: var(--cg-gap, 8px);
	}
	.trace-data-form :global(fieldset) {
		min-width: 0;
		padding: var(--cg-gap, 8px);
		border: 1px solid var(--cg-border-default);
	}
	.trace-data-form :global(input:focus-visible),
	.trace-data-form :global(select:focus-visible),
	.trace-data-form :global(textarea:focus-visible),
	.trace-data-form :global(button:focus-visible) {
		outline: 2px solid var(--cg-accent);
		outline-offset: 2px;
	}
	.trace-data-form :global([aria-invalid='true']) {
		border-color: var(--cg-danger);
	}
	.trace-data-form :global(.sjsf-description),
	.trace-data-form :global(.sjsf-help) {
		color: var(--cg-text-muted);
		font-size: 0.875rem;
	}
</style>
