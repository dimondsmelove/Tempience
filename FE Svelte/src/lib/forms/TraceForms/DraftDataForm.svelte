<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import {
		AFTER_TOUCHED,
		Content,
		Form,
		ON_BLUR,
		ON_INPUT,
		createForm,
		setFormContext,
		type Schema,
		type UiSchemaRoot
	} from '@sjsf/form';
	import { createFormIdBuilder } from '@sjsf/form/id-builders/modern';
	import { createFormMerger } from '@sjsf/form/mergers/modern';
	import { resolver } from '@sjsf/form/resolvers/compat';
	import { locale } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import type { JsonObject, TraceKindV } from '$lib/state/triplit/types';
	import { formTheme, formUiSchema, formValidator } from './runtime';
	import { formTranslation } from './validation';

	let {
		draft,
		version,
		label,
		disabled = false
	}: { draft: TraceDraftState; version: TraceKindV; label: string; disabled?: boolean } = $props();
	// The definition is pinned for the life of this mount; a version change remounts the form.
	const pinned = untrack(() => $state.snapshot(version as unknown) as TraceKindV);
	const form = createForm<Record<string, unknown>>({
		theme: formTheme,
		schema: pinned.dataSchema as Schema,
		uiSchema: formUiSchema(pinned) as UiSchemaRoot,
		// The draft owns the typed values: SJSF edits them in place, so there is no second copy
		// and internal navigation that keeps this subtree mounted keeps every intermediate input.
		value: [() => draft.data, (next) => (draft.data = (next ?? {}) as JsonObject)],
		// Accepted policy: a field shows its first error after blur, then re-validates on input.
		fieldsValidationMode: ON_INPUT | ON_BLUR | AFTER_TOUCHED,
		// SJSF's own words follow the language; the form, its value and its errors stay mounted.
		get translation() {
			return formTranslation(locale.current);
		},
		resolver,
		merger: createFormMerger,
		validator: formValidator,
		idBuilder: createFormIdBuilder,
		get disabled() {
			return disabled;
		}
	});
	setFormContext(form);
	/**
	 * Text the browser could not parse (a lone «-», «1e») reaches SJSF as no value at all; only
	 * the control knows. The draft is told how many controls hold such text, so it counts as
	 * unfinished input rather than as an omitted field.
	 */
	const reportNative = (root: HTMLElement): void =>
		draft.reportNative(
			[...root.querySelectorAll<HTMLInputElement>('input')].filter(
				(input) => input.validity.badInput
			).length
		);
	onDestroy(() => draft.reportNative(0));
</script>

<div class="trace-data-form min-w-0" data-testid="typed-data-form">
	<Form
		attributes={{
			'aria-label': label,
			novalidate: true,
			oninputcapture: (event) => reportNative(event.currentTarget),
			onchangecapture: (event) => reportNative(event.currentTarget),
			onblurcapture: (event) => {
				reportNative(event.currentTarget);
				draft.touch('data');
			}
		}}
	>
		<Content />
	</Form>
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
	.trace-data-form :global(fieldset) {
		min-width: 0;
		padding: var(--cg-gap, 8px);
		border: 1px solid var(--cg-border-default);
	}
	.trace-data-form :global(input:focus-visible),
	.trace-data-form :global(select:focus-visible),
	.trace-data-form :global(textarea:focus-visible) {
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
