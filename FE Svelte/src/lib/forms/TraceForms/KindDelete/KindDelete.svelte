<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { TraceKind } from '$lib/state/triplit/types';
	import Button from '$lib/ui/Button/Button.svelte';

	let { kind }: { kind: TraceKind } = $props();
	const id = $props.id();
	let asking = $state(false);
	let busy = $state(false);
	let failure = $state.raw<unknown>(null);
	const show: Attachment<HTMLDialogElement> = (element) => {
		element.showModal();
		return () => element.close();
	};
	const remove = async (): Promise<void> => {
		busy = true;
		failure = null;
		try {
			// The page stays: it now says the Kind is deleted and offers it back right there.
			await repository.setTraceKindDeleted(kind.id, true);
			asking = false;
		} catch (cause) {
			failure = cause ?? new Error();
		} finally {
			busy = false;
		}
	};
</script>

<!-- A Kind is deleted softly (owner, 2026-09-29): it leaves the catalog and every choice of a
     Kind, its records stay where they are, and the deletion is undone like any other. The
     question says exactly that before anything happens. -->
<Button variant="quiet" data-testid="kind-delete" onclick={() => (asking = true)}
	><TrashBinOutline class="h-4 w-4" aria-hidden="true" />{t('kind.delete')}</Button
>
{#if asking}
	<dialog
		class="kind-delete-dialog"
		aria-labelledby={`${id}-title`}
		aria-describedby={`${id}-text`}
		oncancel={(event) => {
			event.preventDefault();
			if (!busy) asking = false;
		}}
		{@attach show}
	>
		<h2 id={`${id}-title`} class="text-base font-semibold">
			{t('kind.deleteTitle', { name: kind.name })}
		</h2>
		<p id={`${id}-text`} class="mt-2 text-sm text-muted">{t('kind.deleteText')}</p>
		{#if failure !== null}<p class="mt-2 text-sm text-[color:var(--cg-danger)]" role="alert">
				{errorText(failure)}
			</p>{/if}
		<div class="mt-4 flex flex-wrap justify-end gap-2">
			<Button disabled={busy} onclick={() => (asking = false)}>{t('common.cancel')}</Button>
			<Button variant="primary" disabled={busy} data-testid="kind-delete-confirm" onclick={remove}
				>{t('kind.deleteConfirm')}</Button
			>
		</div>
	</dialog>
{/if}

<style>
	.kind-delete-dialog {
		margin: auto;
		max-width: min(26rem, calc(100vw - 32px));
		padding: var(--cg-panel-padding, 16px);
		color: var(--cg-text-primary);
		background: var(--cg-bg-surface);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	.kind-delete-dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
</style>
