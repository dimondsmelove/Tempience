<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import Button from '$lib/ui/Button/Button.svelte';
	import MobileSheet from '$lib/ui/MobileSheet/MobileSheet.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { DeletePlan } from './types';
	let {
		title,
		plan,
		sharedChild,
		sharedParent,
		initialWidth = 1024,
		cancel,
		confirm
	}: {
		title: string;
		plan: DeletePlan;
		initialWidth?: number;
		sharedChild?: string;
		sharedParent?: string;
		cancel: () => void;
		confirm: (mode: 'all' | 'only') => Promise<void>;
	} = $props();
	let width = $state(1024);
	const isMobile = $derived(width <= 800 || initialWidth <= 800);
	let busy = $state(false);
	const id = $props.id();
	const show: Attachment<HTMLDialogElement> = (element) => {
		const previous = document.activeElement as HTMLElement | null;
		element.showModal();
		return () => {
			element.close();
			if (previous?.isConnected) previous.focus();
		};
	};
	const remove = async (mode: 'all' | 'only') => {
		if (busy) return;
		busy = true;
		try {
			await confirm(mode);
		} finally {
			busy = false;
		}
	};
</script>

<svelte:window bind:innerWidth={width} />
{#if isMobile}
	<MobileSheet
		label={t('intentions.deleteTitle', { title })}
		onclose={() => {
			if (!busy) cancel();
		}}
	>
		<div class="mobile-delete">{@render content()}</div>
	</MobileSheet>
{:else}
	<dialog
		{@attach show}
		aria-labelledby={`${id}-title`}
		onclick={(event) => {
			if (event.target === event.currentTarget && !busy) cancel();
		}}
		oncancel={(event) => {
			event.preventDefault();
			if (!busy) cancel();
		}}
	>
		{@render content()}
	</dialog>
{/if}

{#snippet content()}
	<h2 id={`${id}-title`}>{t('intentions.deleteTitle', { title })}</h2>
	<p>
		{t('intentions.deleteDescendants', { count: plan.descendantCount + plan.keptShared.length })}
	</p>
	{#if plan.keptShared.length === 1}
		<p>
			{t('intentions.deleteShared', {
				count: 1,
				child: sharedChild ?? '',
				parent: sharedParent ?? ''
			})}
		</p>
	{:else if plan.keptShared.length > 1}
		<p>{t('intentions.deleteShared', { count: plan.keptShared.length })}</p>
	{/if}
	<div class="actions">
		<Button type="button" variant="primary" disabled={busy} onclick={() => void remove('all')}>
			{t('intentions.deleteAll', { count: plan.descendantCount })}
		</Button>
		<Button type="button" disabled={busy} onclick={() => void remove('only')}
			>{t('intentions.deleteOnly')}</Button
		>
		<Button type="button" data-sheet-initial-focus autofocus onclick={cancel}
			>{t('common.cancel')}</Button
		>
	</div>
{/snippet}

<style>
	dialog {
		margin: auto;
		width: min(360px, calc(100vw - 32px));
		max-width: calc(100vw - 32px);
		padding: 14px;
		color: var(--cg-text-primary);
		background: var(--cg-bg-surface);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	h2 {
		margin: 0 0 6px;
		font-size: 14px;
		font-weight: 600;
		overflow-wrap: anywhere;
	}
	p {
		margin: 0 0 8px;
		color: var(--cg-text-muted);
		font-size: 13px;
		line-height: 1.45;
		overflow-wrap: anywhere;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 12px;
	}
	.mobile-delete {
		padding: 0 16px 16px;
	}
	.mobile-delete h2 {
		font-size: 16px;
	}
	.mobile-delete :global(button) {
		min-height: 44px;
	}
</style>
