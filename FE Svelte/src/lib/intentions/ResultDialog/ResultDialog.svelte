<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { CalendarMonthOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import MobileSheet from '$lib/ui/MobileSheet/MobileSheet.svelte';
	import DatePopover from '../Board/DatePopover.svelte';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import type { ResultOutcome } from '../Outcome/types';
	import type { MoveTarget } from '../MoveIntention/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { hasResultText, tomorrowTarget } from './result';
	let {
		outcome,
		title,
		zone,
		weekStart,
		failure = '',
		cancel,
		save
	}: {
		outcome: ResultOutcome;
		title: string;
		zone: string;
		weekStart: number;
		failure?: string;
		cancel: () => void;
		save: (text: string, target: MoveTarget | null) => Promise<boolean | 'move-failed'>;
	} = $props();
	let width = $state(1024);
	let text = $state('');
	let target = $state<MoveTarget | null>(null);
	let saving = $state(false);
	let recorded = $state(false);
	const id = $props.id();
	const show: Attachment<HTMLDialogElement> = (element) => {
		const previous = document.activeElement as HTMLElement | null;
		element.showModal();
		return () => {
			element.close();
			if (previous?.isConnected) previous.focus();
		};
	};
	const tomorrow = () => tomorrowTarget(zone);
	const submit = async () => {
		if (!hasResultText(text) || saving || recorded) return;
		saving = true;
		try {
			const result = await save(text, target);
			if (result === 'move-failed') recorded = true;
			else if (result) cancel();
		} finally {
			saving = false;
		}
	};
</script>

<svelte:window bind:innerWidth={width} />
{#if width <= 800}
	<MobileSheet
		label={t(`intentions.resultTitle.${outcome}`)}
		onclose={() => {
			if (!saving) cancel();
		}}
	>
		<div class="mobile-result">{@render content()}</div>
	</MobileSheet>
{:else}
	<dialog
		{@attach show}
		aria-labelledby={`${id}-title`}
		oncancel={(event) => {
			event.preventDefault();
			if (!saving) cancel();
		}}
	>
		{@render content()}
	</dialog>
{/if}

{#snippet content()}
	<h2 id={`${id}-title`}>
		<OutcomeIcon {outcome} size={14} />
		{t(`intentions.resultTitle.${outcome}`)}
	</h2>
	<div class="task-title">{title}</div>
	<!-- svelte-ignore a11y_autofocus -->
	<textarea
		autofocus={width > 800}
		data-sheet-initial-focus
		rows="2"
		required
		disabled={recorded}
		placeholder={t('intentions.resultText')}
		aria-label={t('intentions.resultText')}
		bind:value={text}></textarea>
	{#if outcome === 'partial'}
		<p>{t('intentions.moveRemainder')}</p>
		<div class="chips">
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={target?.kind === 'day' && target.dayKey === tomorrow().dayKey}
				onclick={() => (target = tomorrow())}>{t('intentions.tomorrow')}</Button
			>
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={target?.kind === 'week'}
				onclick={() => (target = { kind: 'week', weekStart })}>{t('intentions.week')}</Button
			>
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={target?.kind === 'undated'}
				onclick={() => (target = { kind: 'undated' })}>{t('intentions.undated')}</Button
			>
			<DatePopover
				value={target?.kind === 'day' ? target.dayKey : ''}
				label={t('intentions.date')}
				disabled={recorded || saving}
				variant="default"
				icon
				onchange={(value) => (target = { kind: 'day', dayKey: value })}
				><CalendarMonthOutline width="16" height="16" aria-hidden="true" /></DatePopover
			>
		</div>
	{/if}
	{#if failure}<p role="alert">{failure}</p>{/if}
	<footer>
		<span>{t('intentions.resultNow')}</span><Button
			variant="quiet"
			size="sm"
			disabled={saving}
			onclick={cancel}>{t(recorded ? 'common.close' : 'common.cancel')}</Button
		><Button
			variant="primary"
			size="sm"
			disabled={!hasResultText(text) || saving || recorded}
			onclick={submit}
			>{t(outcome === 'partial' ? 'intentions.resultSave' : 'intentions.resultSaveClose')}</Button
		>
	</footer>
{/snippet}

<style>
	dialog {
		margin: auto;
		width: min(300px, calc(100vw - 32px));
		max-width: calc(100vw - 32px);
		padding: 10px;
		color: var(--cg-text-primary);
		background: var(--cg-bg-surface);
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.4);
	}
	h2 {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 500;
		font-size: 13px;
		margin-bottom: 8px;
	}
	.task-title {
		margin-bottom: 8px;
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	textarea {
		display: block;
		width: 100%;
		min-height: 48px;
		resize: none;
		border: 1px solid var(--cg-accent);
		border-radius: var(--cg-radius-control);
		padding: 6px 10px;
		font-size: 14px;
		line-height: 1.375;
		color: var(--cg-text-primary);
		background: var(--cg-bg-raised);
	}
	p {
		color: var(--cg-text-muted);
		font-size: 12px;
		margin: 8px 0;
	}
	.chips,
	footer {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	footer {
		margin-top: 8px;
		justify-content: flex-end;
	}
	footer span {
		margin-right: auto;
		color: var(--cg-text-muted);
		font-size: 12px;
	}
	.mobile-result {
		padding: 0 16px 16px;
	}
	.mobile-result h2 {
		display: inline-flex;
		margin-right: 6px;
		font-size: 16px;
	}
	.mobile-result .task-title {
		display: inline;
		font-size: 16px;
	}
	.mobile-result textarea {
		margin-top: 8px;
		font-size: 16px;
	}
	.mobile-result :global(button) {
		min-height: 44px;
	}
</style>
