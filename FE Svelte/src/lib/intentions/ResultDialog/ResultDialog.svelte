<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { CalendarMonthOutline } from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import MobileSheet from '$lib/ui/MobileSheet/MobileSheet.svelte';
	import DatePopover from '../Board/DatePopover.svelte';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import type { ResultOutcome } from '../Outcome/types';
	import type { MoveTarget } from '../MoveIntention/types';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import {
		hasResultText,
		savesAndCloses,
		selectCarry,
		toggleCopyDay,
		tomorrowTarget
	} from './result';
	import { repeatDays } from '../RepeatIntention/targets';
	let {
		outcome,
		title,
		copyTime = '',
		zone,
		weekStart,
		failure = '',
		cancel,
		save
	}: {
		outcome: ResultOutcome;
		title: string;
		copyTime?: string;
		zone: string;
		weekStart: number;
		failure?: string;
		cancel: () => void;
		save: (
			text: string,
			target: MoveTarget | null,
			copyDay: string | null
		) => Promise<boolean | 'move-failed'>;
	} = $props();
	let width = $state(1024);
	let text = $state('');
	let target = $state<MoveTarget | null>(null);
	let copyDay = $state<string | null>(null);
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
	const copyTarget = (offset: number) => {
		const days = repeatDays(Date.now(), zone);
		return offset === 1 ? days.tomorrow : days.nextWeek;
	};
	const setCarry = (value: MoveTarget | null) => {
		const next = selectCarry(value);
		target = next.carry;
		copyDay = next.copyDay;
	};
	const toggleCopy = (day: string) => {
		const next = toggleCopyDay({ carry: target, copyDay }, day);
		target = next.carry;
		copyDay = next.copyDay;
	};
	const selectCopy = (day: string) => {
		target = null;
		copyDay = day;
	};
	const closes = $derived(savesAndCloses(outcome, copyDay));
	const copyLabel = (day: string) =>
		new Intl.DateTimeFormat(locale.current, {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			timeZone: 'UTC'
		})
			.format(new Date(`${day}T12:00:00Z`))
			.replace(',', '');
	const submit = async () => {
		if (!hasResultText(text) || saving || recorded) return;
		saving = true;
		try {
			const result = await save(text, target, copyDay);
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
				onclick={() =>
					setCarry(
						target?.kind === 'day' && target.dayKey === tomorrow().dayKey ? null : tomorrow()
					)}>{t('intentions.tomorrow')}</Button
			>
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={target?.kind === 'week'}
				onclick={() => setCarry(target?.kind === 'week' ? null : { kind: 'week', weekStart })}
				>{t('intentions.week')}</Button
			>
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={target?.kind === 'undated'}
				onclick={() => setCarry(target?.kind === 'undated' ? null : { kind: 'undated' })}
				>{t('intentions.undated')}</Button
			>
			<DatePopover
				value={target?.kind === 'day' ? target.dayKey : ''}
				label={t('intentions.date')}
				disabled={recorded || saving}
				variant="default"
				icon
				onchange={(value) => setCarry({ kind: 'day', dayKey: value })}
				><CalendarMonthOutline width="16" height="16" aria-hidden="true" /></DatePopover
			>
		</div>
	{/if}
	<div class="copy-block">
		<p>
			{t(outcome === 'partial' ? 'intentions.repeatCopyClose' : 'intentions.repeatCopy')}
			<span
				>{t(outcome === 'alternative' ? 'intentions.optional' : 'intentions.repeatCloseHint')}</span
			>
		</p>
		<div class="chips">
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={copyDay === copyTarget(1)}
				onclick={() => toggleCopy(copyTarget(1))}>{t('intentions.tomorrow')}</Button
			>
			<Button
				size="sm"
				disabled={recorded || saving}
				pressed={copyDay === copyTarget(7)}
				onclick={() => toggleCopy(copyTarget(7))}>{t('intentions.repeat.week')}</Button
			>
			<DatePopover
				value={copyDay ?? ''}
				label={t('intentions.date')}
				disabled={recorded || saving}
				variant="default"
				icon
				onchange={selectCopy}
				onclear={() => (copyDay = null)}
				><CalendarMonthOutline width="16" height="16" aria-hidden="true" /></DatePopover
			>
		</div>
		{#if copyDay}<div class="copy-preview">
				{t('intentions.copyPreview', {
					date: copyLabel(copyDay),
					time: copyTime ? `, ${copyTime}` : ''
				})}
			</div>{/if}
	</div>
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
			onclick={submit}>{t(closes ? 'intentions.resultSaveClose' : 'intentions.resultSave')}</Button
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
	.copy-block {
		margin-top: 10px;
		padding-top: 2px;
	}
	.copy-preview {
		margin-top: 6px;
		color: var(--cg-text-muted);
		font-size: 12px;
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
