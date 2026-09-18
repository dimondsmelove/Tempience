<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { monthNames } from './constants';
	import { untrack } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import TimeWheel from './TimeWheel.svelte';
	import type { TimeInputState } from './TimeInputState.svelte';
	let { picker }: { picker: TimeInputState } = $props();
	const date = $derived(new SvelteDate(picker.point));
	let anchor = $state(untrack(() => date.getFullYear()));
	const years = $derived(
		Array.from({ length: 81 }, (_, i) => anchor - 40 + i)
			.filter((value) => value > 0 && value <= 9999)
			.map((value) => ({ value, label: String(value) }))
	);
	// The names follow the language; the chosen month is the date's, not the wheel's.
	const months = $derived(monthNames(locale.current).map((label, value) => ({ value, label })));
	function choose(year: number, month = date.getMonth()) {
		if (!Number.isInteger(year) || year < 1 || year > 9999) return;
		const precision = picker.draft.date;
		const value = new SvelteDate(picker.point);
		value.setDate(1);
		value.setFullYear(year, month);
		picker.chooseDay(value.getTime());
		picker.draft = { ...picker.draft, date: precision };
		if (Math.abs(year - anchor) > 32) anchor = year;
	}
</script>

<div class="precision-wheel">
	{#if picker.draft.date !== 'year'}
		<label class="year-choice"
			>{t('time.year')}<select
				class="cg-field"
				aria-label={t('time.year')}
				value={date.getFullYear()}
				onchange={(event) => choose(Number(event.currentTarget.value))}
			>
				{#each years as year (year.value)}<option value={year.value}>{year.label}</option>{/each}
			</select></label
		>
		<TimeWheel
			label={t('time.month')}
			options={months}
			value={date.getMonth()}
			compact
			onchange={(month) => month !== null && choose(date.getFullYear(), month)}
		/>
	{:else}
		<TimeWheel
			label={t('time.year')}
			options={years}
			value={date.getFullYear()}
			numeric
			numericDigits={4}
			compact
			onnumber={choose}
			onchange={(year) => year !== null && choose(year)}
		/>
	{/if}
</div>

<style>
	.precision-wheel {
		min-width: 0;
	}
	.year-choice {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
	}
	.year-choice select {
		height: 44px;
		min-width: 0;
		flex: 1;
	}
	.precision-wheel :global(.time-wheel) {
		width: 100%;
	}
</style>
