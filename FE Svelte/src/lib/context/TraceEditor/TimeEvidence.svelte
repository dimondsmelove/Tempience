<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { Snippet } from 'svelte';
	import type { TimeInputState } from '$lib/ui/TimeInput/TimeInputState.svelte';
	import type { TimeSelection } from '$lib/ui/TimeInput/types';
	import { measuredDuration } from '$lib/ui/TimeInput/duration';
	let { picker, resets }: { picker: TimeInputState; resets: Snippet } = $props();
	function precision(value: string) {
		if (value === 'day') {
			picker.calendar = true;
			return;
		}
		picker.draft = { ...picker.draft, timed: false, date: value as TimeSelection['date'] };
	}
	function unknown() {
		if (measuredDuration(picker.draft)) picker.setDetail('duration');
		picker.draft = { ...picker.draft, date: 'unknown', timed: false, end: null, window: false };
		picker.cancelEnd();
		picker.calendar = false;
	}
</script>

<details class="time-evidence">
	<summary>{t('time.refineMore')}</summary>
	<div>
		{#if !picker.unplaced}
			<label
				><input
					type="checkbox"
					checked={picker.draft.approximate ?? false}
					onchange={(event) => {
						picker.draft = {
							...picker.draft,
							approximate: event.currentTarget.checked,
							...(!event.currentTarget.checked && picker.draft.window
								? { window: false, end: null }
								: {})
						};
					}}
				/>{t('time.approximate')}</label
			>
			{#if picker.draft.approximate && (picker.detail === 'duration' || picker.draft.end === null || picker.draft.window)}
				<button
					type="button"
					onclick={() => {
						picker.draft = { ...picker.draft, window: true };
						picker.beginEnd();
					}}>{t('time.setLateStart')}</button
				>
			{/if}
		{/if}
		<label
			>{t('time.precision')}<select
				class="cg-field"
				aria-label={t('time.precision')}
				value={picker.draft.date ?? 'day'}
				onchange={(event) => precision(event.currentTarget.value)}
			>
				{#if picker.unplaced}<option value={picker.draft.date}>{t('time.dateNotChosen')}</option
					>{/if}
				{#if picker.draft.date === 'season'}<option value="season"
						>{t('time.seasonOriginal')}</option
					>{/if}
				<option value="day">{t('time.day')}</option><option value="month">{t('time.month')}</option
				><option value="year">{t('time.year')}</option>
			</select></label
		>
		<button type="button" onclick={unknown}>{t('time.unknown')}</button>
		{@render resets()}
	</div>
</details>

<style>
	.time-evidence {
		margin-top: 8px;
		font-size: 12px;
	}
	summary {
		cursor: pointer;
		min-height: 44px;
		display: flex;
		align-items: center;
		color: var(--cg-text-muted);
	}
	.time-evidence > div {
		display: grid;
		gap: 8px;
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
	}
	select {
		height: 44px;
		flex: 1;
		min-width: 0;
	}
	button {
		text-align: left;
	}
</style>
