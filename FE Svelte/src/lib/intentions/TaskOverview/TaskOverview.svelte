<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import ContextSection from '$lib/context/ContextSection/ContextSection.svelte';
	import ContextActions from '$lib/context/ContextActions/ContextActions.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { CalendarMonthOutline, PenOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import OutcomeCircle from '../OutcomeCircle/OutcomeCircle.svelte';
	import TaskStatus from '../TaskStatus/TaskStatus.svelte';
	import DatePopover from '../Board/DatePopover.svelte';
	import TaskInlineField from '../Board/TaskInlineField.svelte';
	import { traceDate } from '../Board/panel';
	import { OVERVIEW_SECTION_ID } from './constants';
	import type { TaskOverviewProps } from './types';
	let {
		trace,
		relations,
		zone,
		complete,
		preset,
		setStatus,
		setPanelOutcome,
		ondelete,
		move,
		onnavigate,
		onedit,
		onrefresh,
		collapsed,
		ontoggle
	}: TaskOverviewProps = $props();
	const day = $derived(traceDate(trace, zone));
	const closed = $derived(trace.intentOpen === false);
	const dateText = $derived(
		day
			? new Intl.DateTimeFormat(locale.current, {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					timeZone: 'UTC'
				}).format(new Date(`${day}T12:00:00Z`))
			: t('intentions.undated')
	);
	const time = $derived(
		trace.aboutTime?.basis === 'absolute' && trace.aboutTime.precision === 'minute'
			? new Intl.DateTimeFormat(locale.current, {
					hour: '2-digit',
					minute: '2-digit',
					timeZone: zone
				}).format(new Date(trace.aboutTime.start))
			: ''
	);
</script>

<ContextSection
	id={OVERVIEW_SECTION_ID}
	label={t('intentions.overview')}
	{collapsed}
	{ontoggle}
	flushFirst
>
	{#each relations.parents as parent (parent.id)}<div class="text-sm text-muted">
			{t('intentions.belongsTo')} ›
			<button class="parent-link text-ink" type="button" onclick={() => onnavigate(parent.id)}
				>{parent.content.split('\n')[0]}</button
			>
		</div>{/each}
	<div class:closed class:completed={trace.intentOutcome === 'completed'} class="title-row">
		<OutcomeCircle
			outcome={trace.intentOutcome}
			open={!closed}
			activate={() => complete(trace.id)}
			preset={(value) => preset(trace.id, value)}
		/>
		<div class="title-field">
			<TaskInlineField id={trace.id} field="title" value={trace.content} {onrefresh} />
		</div>
	</div>
	<div class="date">
		<DatePopover
			value={day}
			label={t('intentions.date')}
			disabled={closed}
			variant="quiet"
			onchange={(value) => move(trace.id, value)}
			onclear={() => move(trace.id, null)}
			><CalendarMonthOutline width="16" height="16" aria-hidden="true" />
			<span class="mono">{dateText}{time ? ` · ${time}` : ''}</span></DatePopover
		>
	</div>
	<TaskStatus
		open={!closed}
		outcome={trace.intentOutcome}
		setOpen={(value) => setStatus(trace.id, value)}
		setOutcome={(value) => setPanelOutcome(trace.id, value)}
	/>
	<ContextActions label={t('intentions.panelEdit')}>
		<Button
			size="sm"
			icon
			type="button"
			aria-label={t('intentions.panelEdit')}
			title={t('intentions.panelEdit')}
			onclick={onedit}><PenOutline class="h-4 w-4" /></Button
		>
		<Button
			size="sm"
			icon
			type="button"
			aria-label={t('intentions.panelDelete')}
			title={t('intentions.panelDelete')}
			onclick={() => ondelete(trace.id)}><TrashBinOutline class="h-4 w-4" /></Button
		>
	</ContextActions>
	<TaskInlineField id={trace.id} field="description" value={trace.description ?? ''} {onrefresh} />
	{#if relations.closeSuggested}<div class="suggestion">
			{t('intentions.panelCloseSuggested')}
		</div>{/if}
</ContextSection>

<style>
	.title-row {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		min-width: 0;
	}
	.title-row :global(.circle) {
		flex: none;
		height: 25px;
	}
	.title-row :global(.menu-trigger > button) {
		visibility: visible;
	}
	.title-field {
		flex: 1;
		min-width: 0;
	}
	.closed .title-field :global(h2 button) {
		color: var(--cg-text-muted);
	}
	.completed .title-field :global(h2 button) {
		text-decoration: line-through;
	}
	.parent-link {
		overflow-wrap: anywhere;
	}
	.date :global(button.cg-control-sm) {
		min-height: 0;
		padding: 0;
		border: 0;
		align-items: baseline;
		gap: 0.375rem;
		line-height: 1rem;
	}
	.suggestion {
		color: var(--cg-text-muted);
		font-size: 0.875rem;
	}
	.mono {
		font-family: var(--cg-font-mono);
		font-size: 0.75rem;
		color: var(--cg-text-muted);
	}
</style>
