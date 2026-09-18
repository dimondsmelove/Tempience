<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	const id = $props.id();
	const show: Attachment<HTMLDialogElement> = (element) => {
		element.showModal();
		return () => element.close();
	};
</script>

<!-- The accepted question before an exit ends changed input (TRACE_FORMS «жизненный цикл»);
     Escape and the backdrop keep editing, only «Отбросить изменения» completes the exit. -->
{#if draftGuard.request}
	<dialog
		class="discard-dialog"
		data-testid="discard-dialog"
		aria-labelledby={`${id}-title`}
		oncancel={(event) => {
			event.preventDefault();
			draftGuard.keep();
		}}
		{@attach show}
	>
		<h2 id={`${id}-title`} class="text-base font-semibold">{t('draft.discardTitle')}</h2>
		<div class="mt-4 flex flex-wrap justify-end gap-2">
			<Button data-testid="discard-keep" onclick={() => draftGuard.keep()}
				>{t('draft.keepEditing')}</Button
			>
			<Button variant="primary" data-testid="discard-confirm" onclick={() => draftGuard.discard()}
				>{t('draft.discardChanges')}</Button
			>
		</div>
	</dialog>
{/if}

<style>
	.discard-dialog {
		/* The base styles zero every margin; a modal dialog centres itself by this one. */
		margin: auto;
		max-width: min(24rem, calc(100vw - 32px));
		padding: var(--cg-panel-padding, 16px);
		color: var(--cg-text-primary);
		background: var(--cg-bg-surface);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	.discard-dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
</style>
