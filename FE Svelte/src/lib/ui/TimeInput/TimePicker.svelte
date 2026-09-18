<script lang="ts">
	import './TimePicker.css';
	import type { Snippet } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import ClockWheel from './ClockWheel.svelte';
	import DateColumns from './DateColumns.svelte';
	import DurationInput from './DurationInput.svelte';
	import TimeWheel from './TimeWheel.svelte';
	import { clockLabel, selectionDateLabel, durationLabel } from './TimeInput';

	import type { TimeDetail } from './types';
	import type { TimeInputState } from './TimeInputState.svelte';
	let {
		picker,
		onfinish,
		ondetail,
		actions,
		mobile = false,
		extras,
		allowDuration = true,
		timeline
	}: {
		picker: TimeInputState;
		onfinish: (apply: boolean) => void;
		ondetail: (detail: TimeDetail) => void;
		actions: Snippet;
		mobile?: boolean;
		extras?: Snippet;
		allowDuration?: boolean;
		timeline?: Snippet;
	} = $props();
	const selectedMinute = $derived(
		picker.draft.timed
			? new SvelteDate(picker.point).getHours() * 60 + new SvelteDate(picker.point).getMinutes()
			: null
	);
	const timeOptions = $derived.by(() => {
		const minutes = Array.from({ length: 48 }, (_, i) => i * 30);
		if (selectedMinute !== null && !minutes.includes(selectedMinute)) minutes.push(selectedMinute);
		return [
			{ value: null, label: t('time.noTime') },
			...minutes
				.sort((a, b) => a - b)
				.map((value) => ({
					value,
					label: `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
				}))
		];
	});
	function focus(edge: 'start' | 'end') {
		picker.focus(edge);
	}
	/** What the heading says beside «Когда»: the step, the duration, or the kind of date. */
	const headingHint = $derived(
		picker.pickingEnd
			? t('time.chooseEnd')
			: durationLabel(picker.draft) ||
					(picker.unplaced
						? t('time.dateUnset')
						: picker.draft.timed
							? t('time.dateTime')
							: t('time.dateOnly'))
	);
	const boundaryLabel = (edge: string): string =>
		picker.draft.window
			? edge === 'start'
				? t('time.notBefore')
				: t('time.notAfter')
			: edge === 'start'
				? picker.draft.end === null && !picker.pickingEnd
					? picker.detail === 'duration'
						? t('time.start')
						: t('time.date')
					: t('time.start')
				: t('time.end');
	const scaleAction = $derived(
		picker.detail === 'duration'
			? t('time.changingDay')
			: picker.pickingEnd
				? t('time.chooseEnd')
				: picker.edge === 'end'
					? t('time.changingEnd')
					: t('time.changingStart')
	);
</script>

<div
	role="group"
	class={['time-picker', picker.input === 'timeline' && 'picker-on-scale']}
	aria-label={t('time.when')}
	tabindex="-1"
	data-testid="time-picker"
	{@attach (element) => {
		(element.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus({
			preventScroll: true
		});
	}}
>
	<header class="picker-heading">
		<div>
			<strong>{t('time.when')}</strong><span>{headingHint}</span>
		</div>
		<button
			type="button"
			class="picker-dismiss"
			aria-label={t('time.cancelChoice')}
			onclick={() => onfinish(false)}>×</button
		>
	</header>
	<div
		class={[
			'picker-boundaries',
			picker.draft.end === null && !picker.pickingEnd && 'single-boundary'
		]}
	>
		{#each ['start', 'end'] as edge (edge)}
			{@const value = edge === 'end' ? picker.draft.end : picker.draft.start}
			{#if value !== null}
				<div class={['picker-boundary', picker.edge === edge && 'active']}>
					<button
						type="button"
						aria-pressed={picker.edge === edge}
						data-testid={`${picker.input === 'timeline' ? 'choose' : 'picker'}-${edge}`}
						onclick={() => focus(edge === 'end' ? 'end' : 'start')}
					>
						<small>{boundaryLabel(edge)}</small>
						<span>{selectionDateLabel(picker.draft, value)}</span
						>{#if !picker.draft.window || picker.draft.timed}<b
								>{picker.detail === 'duration'
									? durationLabel(picker.draft) || t('time.noDuration')
									: picker.draft.timed
										? clockLabel(value)
										: t('time.noTime')}</b
							>{/if}
					</button>
					{#if edge === 'end'}<button
							type="button"
							class="remove-end"
							aria-label={picker.draft.window ? t('time.removeLateStart') : t('time.removeEnd')}
							onclick={() => picker.removeEnd()}>×</button
						>{/if}
				</div>
			{/if}
		{/each}
		{#if picker.pickingEnd}<div
				class="picker-boundary active pending-boundary"
				data-testid="pending-end"
			>
				<span>{t('time.end')}</span><strong>{t('time.chooseDayOrTime')}</strong><button
					type="button"
					onclick={() => picker.cancelEnd()}>{t('time.cancelEnd')}</button
				>
			</div>{/if}
	</div>
	<div class="picker-detail-toggle" role="group" aria-label={t('time.detail')}>
		<button
			type="button"
			data-testid="detail-clock"
			aria-pressed={picker.detail === 'clock'}
			onclick={() => {
				ondetail('clock');
			}}>{t('time.clock')}</button
		>
		<button
			type="button"
			data-testid="detail-duration"
			disabled={!allowDuration}
			aria-pressed={picker.detail === 'duration'}
			onclick={() => {
				ondetail('duration');
			}}>{t('time.duration')}</button
		>
	</div>
	<div class="picker-body">
		{#if picker.input === 'timeline'}
			{#if timeline}{@render timeline()}{:else}<p class="picker-scale-hint">
					{t('time.scaleHint', { action: scaleAction })}
				</p>{/if}
		{:else}
			{#key picker.edge}<DateColumns {picker}>
					<div class="picker-clock">
						{#if picker.detail === 'duration'}
							<DurationInput {picker} />
						{:else if picker.draft.date}<p class="date-only-hint">{t('time.pickDayForClock')}</p>
						{:else if picker.timeView === 'wheels'}
							<ClockWheel
								value={picker.draft.timed ? picker.point : null}
								onchange={(h, m) => picker.clock(h, m)}
								onclear={() => picker.removeTime()}
							/>
						{:else}
							<TimeWheel
								label={t('time.time')}
								options={timeOptions}
								value={selectedMinute}
								list
								compact
								onchange={(value) =>
									value === null
										? picker.removeTime()
										: picker.clock(Math.floor(value / 60), value % 60)}
							/>
						{/if}
					</div>
				</DateColumns>{/key}
			{#if picker.detail === 'clock' && !picker.draft.date}<div class="picker-options">
					<div class="picker-view-toggle" role="group" aria-label={t('time.viewToggle')}>
						<button
							type="button"
							aria-pressed={picker.timeView === 'wheels'}
							onclick={() => (picker.timeView = 'wheels')}>{t('time.wheels')}</button
						>
						<button
							type="button"
							aria-pressed={picker.timeView === 'list'}
							onclick={() => (picker.timeView = 'list')}>{t('time.list')}</button
						>
					</div>
					{#if picker.draft.timed}<button
							type="button"
							class="clear-clock"
							onclick={() => picker.removeTime()}>{t('time.noTime')}</button
						>{:else}<span class="date-only-hint">{t('time.timeOptional')}</span>{/if}
				</div>
			{/if}{/if}
		{#if picker.detail === 'clock' && !picker.unplaced && !picker.draft.window && picker.draft.end === null && !picker.pickingEnd}<button
				type="button"
				class="picker-add-end"
				data-testid="picker-add-end"
				onclick={() => picker.beginEnd()}>{t('time.addEnd')}</button
			>{/if}
		{#if picker.draft.window}<p class="date-only-hint">{t('time.windowHint')}</p>{/if}
		{#if extras}{@render extras()}{/if}
	</div>
	{#if picker.durationNotice}<p class="duration-notice" role="status">
			{picker.durationNotice}
		</p>{/if}
	{#if !mobile}{@render actions()}{/if}
</div>
