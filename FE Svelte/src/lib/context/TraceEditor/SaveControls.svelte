<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let {
		draft,
		onsave,
		oncancel
	}: { draft: TraceDraftState; onsave: () => void; oncancel: () => void } = $props();
	const saveTestId = $derived(draft.entry.mode === 'edit' ? 'edit-save' : 'capture-save');
</script>

<!-- The save phase is the draft's: one button, blocked while saving; the committed record
     is never written again from here, only opened again. -->
<div class="grid gap-2" data-testid="save-controls" data-phase={draft.phase}>
	{#if draft.phase === 'saved' || draft.phase === 'opening'}
		<p role="status" class="text-sm">{t('draft.saved')} {t('draft.opening')}</p>
	{:else if draft.phase === 'openFailed'}
		<p role="alert" class="text-sm" data-testid="open-error">
			{t('draft.openFailed', { message: draft.failure ? errorText(draft.failure.cause) : '' })}
		</p>
		<div class="flex flex-wrap gap-2">
			<Button variant="primary" data-testid="retry-open" onclick={() => void draft.retryOpen()}
				>{t('draft.retryOpen')}</Button
			>
			<Button variant="quiet" onclick={oncancel}>{t('draft.close')}</Button>
		</div>
	{:else}
		<div class="flex flex-wrap gap-2">
			<Button
				variant="primary"
				disabled={!draft.canSave}
				aria-busy={draft.phase === 'saving' ? 'true' : undefined}
				data-testid={saveTestId}
				onclick={onsave}>{draft.phase === 'saving' ? t('draft.saving') : t('draft.save')}</Button
			>
			<Button variant="quiet" disabled={draft.phase === 'saving'} onclick={oncancel}
				>{t('draft.cancel')}</Button
			>
		</div>
		{#if draft.failure && draft.diagnostic === null}
			<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="save-error">
				{t('draft.saveFailed', { message: errorText(draft.failure.cause) })}
			</p>
		{/if}
	{/if}
</div>
