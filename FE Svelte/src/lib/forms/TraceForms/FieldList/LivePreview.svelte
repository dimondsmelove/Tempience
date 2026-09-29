<script lang="ts">
	import { compileTraceForm } from '$lib/model/TraceForm/schema';
	import type { TraceFormDraft } from '$lib/model/TraceForm/types';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import DataForm from '../DataForm.svelte';
	import { previewDraft } from './preview';

	let { draft }: { draft: TraceFormDraft } = $props();
	const compiled = $derived.by(() => {
		const words = {
			kind: t('form.new'),
			field: (n: number) => t('form.fieldN', { n }),
			option: (n: number) => t('form.optionN', { n })
		};
		try {
			const snapshot = $state.snapshot(draft) as TraceFormDraft;
			return { definition: compileTraceForm(previewDraft(snapshot, words)), failure: null };
		} catch (failure) {
			return { definition: null, failure };
		}
	});
	/** The form is made again only when what it asks changes, not on every keystroke elsewhere. */
	const signature = $derived(compiled.definition ? JSON.stringify(compiled.definition) : '');
</script>

<!-- The record form as it will be, live beside the builder (research 2026-09-29: every mature
     builder shows it): values typed here are a try-out, nothing is saved. -->
<section
	class="preview grid min-w-0 gap-2"
	aria-label={t('form.previewLive')}
	data-testid="builder-preview"
>
	<h3 class="text-sm text-muted">{t('form.previewLive')}</h3>
	{#if compiled.definition}
		{#key signature}
			<DataForm
				definition={compiled.definition}
				label={t('form.previewLive')}
				submitLabel={t('form.previewSubmit')}
				onsubmit={async () => {}}
			/>
		{/key}
	{:else if draft.fields.length === 0}
		<p class="text-sm text-muted">{t('form.previewEmpty')}</p>
	{:else}
		<p class="text-sm text-muted">
			{t('form.previewBroken', { reason: errorText(compiled.failure) })}
		</p>
	{/if}
</section>

<style>
	/* A try-out, not a record: nothing to submit (audit 2026-09-29). */
	.preview.preview :global(button[type='submit']) {
		display: none;
	}
</style>
