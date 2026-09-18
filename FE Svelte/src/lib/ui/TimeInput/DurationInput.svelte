<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';
	import TimeWheel from './TimeWheel.svelte';
	import { MINUTES } from './constants';
	import type { TimeInputState } from './TimeInputState.svelte';
	import type { DurationUnit } from './types';
	let { picker }: { picker: TimeInputState } = $props();
	const duration = $derived(picker.draft.duration);
	const paired = $derived(picker.durationUnit === 'hour');
	const totalMinutes = $derived(
		duration ? duration.amount * (duration.unit === 'hour' ? 60 : 1) : null
	);
	const amount = $derived(
		paired && totalMinutes !== null ? Math.floor(totalMinutes / 60) : (duration?.amount ?? null)
	);
	const minutes = $derived(totalMinutes === null ? null : totalMinutes % 60);
	let anchor = $state(untrack(() => amount ?? 1));
	const first = $derived(Math.max(1, anchor - 40));
	const options = $derived([
		{ value: null, label: '—' },
		...(paired ? [{ value: 0, label: '0' }] : []),
		...Array.from({ length: 81 }, (_, index) => ({
			value: first + index,
			label: String(first + index)
		}))
	]);
	const minuteOptions = [
		{ value: null, label: '—' },
		...MINUTES.map((value) => ({ value, label: String(value).padStart(2, '0') }))
	];
	function select(value: number | null) {
		if (value !== null && (!Number.isSafeInteger(value) || value < (paired ? 0 : 1))) return;
		if (paired) picker.setDurationTime(value ?? 0, minutes ?? 0);
		else picker.setDuration(value);
		if (value !== null && (value < first + 8 || value > first + 72)) anchor = value;
	}
	function unit(value: DurationUnit) {
		if (picker.durationUnit !== 'day' && value !== 'day') {
			if (value === 'hour')
				picker.setDurationTime(Math.floor((totalMinutes ?? 0) / 60), minutes ?? 0);
			else picker.setDuration(totalMinutes, 'minute');
		} else picker.setDuration(amount || null, value);
		anchor = amount ?? 1;
	}
</script>

<div class="duration-input" data-testid="duration-input">
	<div class:paired class="duration-wheels">
		<TimeWheel
			label={paired ? t('time.hours') : t('time.duration')}
			{options}
			value={amount}
			numeric
			numericDigits={15}
			onnumber={select}
			onchange={select}
		/>
		{#if paired}
			<TimeWheel
				label={t('time.minutes')}
				options={minuteOptions}
				value={minutes}
				numeric
				onchange={(value) => picker.setDurationTime(amount ?? 0, value ?? 0)}
			/>
		{/if}
	</div>
	<div class="duration-actions">
		<button
			type="button"
			aria-label={t('time.decreaseDuration')}
			disabled={amount === null || amount === 0}
			onclick={() => select(amount === null || amount <= 1 ? null : amount - 1)}>−</button
		>
		<select
			class="cg-field"
			aria-label={t('time.durationUnit')}
			value={picker.durationUnit}
			onchange={(event) => unit(event.currentTarget.value as DurationUnit)}
		>
			<option value="minute">{t('time.unitMinutes')}</option>
			<option value="hour">{t('time.unitHours')}</option>
			<option value="day">{t('time.unitDays')}</option>
		</select>
		<button
			type="button"
			aria-label={t('time.increaseDuration')}
			onclick={() => select((amount ?? 0) + 1)}>+</button
		>
	</div>
	{#if amount !== null}<button
			type="button"
			class="clear-duration"
			onclick={() => picker.setDuration(null)}>{t('time.removeDuration')}</button
		>{:else}<span class="duration-hint">{t('time.amountOptional')}</span>{/if}
</div>

<style>
	.duration-input {
		min-width: 0;
	}
	.duration-input :global(.time-wheel) {
		width: 100%;
	}
	.duration-wheels {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 4px;
	}
	.duration-wheels.paired {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.duration-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		margin-top: 8px;
	}
	.duration-actions button {
		width: 44px;
		flex-shrink: 0;
		font-size: 20px;
	}
	.duration-actions select {
		flex: 1;
		min-width: 0;
		height: 44px;
		padding: 0 4px;
		font-size: 12px;
	}
	.clear-duration,
	.duration-hint {
		display: block;
		width: 100%;
		margin-top: 4px;
		font-size: 11px;
		text-align: center;
		color: var(--cg-text-muted);
	}
</style>
