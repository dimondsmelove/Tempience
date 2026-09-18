<script lang="ts">
	import './TimeInputControls.css';
	import Button from '$lib/ui/Button/Button.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import ClockWheel from './ClockWheel.svelte';
	import { dateLabel, clockLabel, dayAt, windowAt } from './TimeInput';
	import { monthNames } from './constants';
	import type { TimeInputState } from './TimeInputState.svelte';
	let { picker, boundaries = true }: { picker: TimeInputState; boundaries?: boolean } = $props();
	const id = $props.id();
	const month = $derived(
		dateTimeFormat(locale.current, { month: 'long', year: 'numeric' }).format(
			(picker.viewport.target.start + picker.viewport.target.end) / 2
		)
	);
	const months = $derived(monthNames(locale.current));
	let year = $state(new Date().getFullYear());
</script>

<div class="time-input-controls">
	{#if boundaries}<div class="input-boundaries" data-testid="input-boundaries">
			{#each ['start', 'end'] as edge (edge)}
				{@const value = edge === 'end' ? picker.draft.end : picker.draft.start}
				{#if value !== null}
					<button
						class={['input-boundary', picker.edge === edge && 'active']}
						aria-pressed={picker.edge === edge}
						data-testid={`choose-${edge}`}
						onclick={() => picker.focus(edge === 'end' ? 'end' : 'start')}
					>
						<small
							>{picker.draft.end === null
								? t('time.when')
								: edge === 'start'
									? t('time.start')
									: t('time.end')}</small
						>
						<span
							>{dateLabel(value)}{#if picker.draft.timed}<b>{clockLabel(value)}</b>{/if}</span
						>
					</button>
				{/if}
			{/each}
			{#if picker.pickingEnd}
				<button
					class="input-boundary active"
					onclick={() => picker.cancelEnd()}
					data-testid="pending-end"
				>
					<small>{t('time.end')}</small><span>{t('time.chooseOnScale')}</span>
				</button>
			{/if}
			{#if picker.draft.end !== null || picker.draft.timed}
				<Popover id={`${id}-more`} label={t('time.more')} testId="time-more">
					{#snippet trigger()}···{/snippet}
					{#snippet children(close)}
						<div class="input-more">
							{#if picker.draft.end !== null}<Button
									variant="quiet"
									onclick={() => {
										picker.removeEnd();
										close();
									}}>{t('time.removeEnd')}</Button
								>{/if}
							{#if picker.draft.timed}<Button
									variant="quiet"
									onclick={() => {
										picker.removeTime();
										close();
									}}>{t('time.keepDateOnly')}</Button
								>{/if}
						</div>
					{/snippet}
				</Popover>
			{/if}
		</div>{/if}
	<div class="input-navigation">
		{#if picker.detail === 'clock' && picker.mode === 'minute'}
			<Button variant="quiet" size="sm" onclick={() => picker.days()}>{t('time.toDays')}</Button>
			<Popover
				id={`${id}-clock`}
				label={t('time.pickClock')}
				testId="clock-open"
				class="input-clock"
			>
				{#snippet trigger()}{clockLabel(picker.point)} ⌄{/snippet}
				{#snippet children(close)}
					<div class="clock-panel">
						{#key picker.edge + '/' + dayAt(picker.point)}<ClockWheel
								value={picker.point}
								onchange={(h, m) => picker.clock(h, m)}
							/>{/key}
						<Button variant="quiet" onclick={close}>{t('time.done')}</Button>
					</div>
				{/snippet}
			</Popover>
		{:else}
			<Popover id={`${id}-months`} label={t('time.jumpMonth')}>
				{#snippet trigger()}{month} ⌄{/snippet}
				{#snippet children(close)}
					<div class="month-jump">
						<div class="year-navigation">
							<Button
								variant="quiet"
								icon
								aria-label={t('time.previousYear')}
								onclick={() => year--}>‹</Button
							>
							<span>{year}</span>
							<Button variant="quiet" icon aria-label={t('time.nextYear')} onclick={() => year++}
								>›</Button
							>
						</div>
						<div class="month-grid">
							{#each months as name, i (i)}
								<button
									onclick={() => {
										picker.windowTo(windowAt(new Date(year, i, 15, 12).getTime(), 'day'), 320);
										close();
									}}>{name}</button
								>
							{/each}
						</div>
					</div>
				{/snippet}
			</Popover>
			{#if picker.detail === 'clock' && !picker.draft.date}<Button
					variant="quiet"
					size="sm"
					onclick={() => picker.hours()}
					>{picker.draft.timed ? t('time.toHours') : t('time.setTime')} ›</Button
				>{/if}
		{/if}
		<div class="input-zoom">
			<Button
				variant="quiet"
				icon
				size="sm"
				aria-label={t('time.zoomOut')}
				onclick={() => picker.zoom(1.6)}>−</Button
			>
			<Button
				variant="quiet"
				icon
				size="sm"
				aria-label={t('time.zoomIn')}
				onclick={() => picker.zoom(0.625)}>+</Button
			>
		</div>
	</div>
</div>
