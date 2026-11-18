<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { calendarDate, localDateValue } from './DateInput';
	let {
		value,
		todayKey,
		dayButtonClass = 'h-8 min-h-8 p-0',
		onselect
	}: {
		value?: Date;
		todayKey?: string;
		dayButtonClass?: string;
		onselect: (date: Date) => void;
	} = $props();
	let monthOffset = $state(0);
	let showMonthSelector = $state(false);
	const baseDate = $derived(value ?? (todayKey ? calendarDate(todayKey) : undefined) ?? new Date());
	const monthDate = $derived(
		new Date(baseDate.getFullYear(), baseDate.getMonth() + monthOffset, 1, 12)
	);
	const monthLabel = $derived(
		dateTimeFormat(locale.current, { month: 'long', year: 'numeric' }).format(monthDate)
	);
	const selectedKey = $derived(value ? localDateValue(value) : null);
	const localTodayKey = $derived(todayKey ?? localDateValue(new Date()));
	const days = $derived.by(() => {
		const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
		const mondayOffset = (firstDay.getDay() + 6) % 7;
		const start = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - mondayOffset, 12);
		return Array.from({ length: 42 }, (_, index) => {
			const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index, 12);
			return { date, key: localDateValue(date), inMonth: date.getMonth() === monthDate.getMonth() };
		});
	});
	const weekdays = $derived.by(() => {
		const monday = new Date(2024, 0, 1, 12);
		return Array.from({ length: 7 }, (_, index) => {
			const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index, 12);
			return dateTimeFormat(locale.current, { weekday: 'short' }).format(date);
		});
	});
	const monthFormatter = $derived(dateTimeFormat(locale.current, { dateStyle: 'full' }));
	const monthNames = $derived.by(() =>
		Array.from({ length: 12 }, (_, index) =>
			dateTimeFormat(locale.current, { month: 'short' }).format(
				new Date(monthDate.getFullYear(), index, 1, 12)
			)
		)
	);
	function chooseMonth(index: number) {
		monthOffset =
			(monthDate.getFullYear() - baseDate.getFullYear()) * 12 + index - baseDate.getMonth();
		showMonthSelector = false;
	}
</script>

<div class="calendar" data-testid="date-calendar">
	<div class="calendar-nav">
		<button
			type="button"
			class="month-step"
			aria-label={t('intentions.whenPreviousMonth')}
			onclick={() => (monthOffset -= 1)}>‹</button
		>
		<button
			type="button"
			class="month-label"
			aria-expanded={showMonthSelector}
			onclick={() => (showMonthSelector = !showMonthSelector)}>{monthLabel}</button
		>
		<button
			type="button"
			class="month-step"
			aria-label={t('intentions.whenNextMonth')}
			onclick={() => (monthOffset += 1)}>›</button
		>
	</div>
	{#if showMonthSelector}
		<div class="year-nav">
			<button
				type="button"
				class="month-step"
				aria-label={t('intentions.whenPreviousYear')}
				onclick={() => (monthOffset -= 12)}>‹</button
			>
			<span aria-live="polite">{monthDate.getFullYear()}</span>
			<button
				type="button"
				class="month-step"
				aria-label={t('intentions.whenNextYear')}
				onclick={() => (monthOffset += 12)}>›</button
			>
		</div>
		<div class="month-grid">
			{#each monthNames as month, index (index)}
				<button
					type="button"
					class="month-option"
					aria-pressed={monthDate.getMonth() === index}
					onclick={() => chooseMonth(index)}>{month}</button
				>
			{/each}
		</div>
	{:else}
		<div class="calendar-grid" role="grid" aria-label={monthLabel}>
			{#each weekdays as weekday (weekday)}
				<div class="weekday" role="columnheader">{weekday}</div>
			{/each}
			{#each days as day (day.key)}
				<button
					type="button"
					class={['day', dayButtonClass, !day.inMonth && 'outside-month']}
					data-day-key={day.key}
					aria-label={monthFormatter.format(day.date)}
					aria-selected={day.key === selectedKey}
					aria-current={day.key === localTodayKey ? 'date' : undefined}
					role="gridcell"
					onclick={() => onselect(day.date)}>{day.date.getDate()}</button
				>
			{/each}
		</div>
	{/if}
</div>

<style>
	.calendar {
		min-width: 0;
		width: 100%;
	}
	.calendar-nav {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) 2rem;
		align-items: center;
		gap: 0.25rem;
		margin-bottom: 0.5rem;
	}
	.month-step,
	.day {
		border: 0;
		border-radius: 999px;
		background: var(--cg-bg-surface);
		color: var(--cg-text-primary);
		font: inherit;
	}
	.month-step {
		min-height: 2rem;
		font-size: 1.25rem;
	}
	.month-step:hover,
	.day:hover {
		background: var(--cg-bg-raised);
	}
	.month-label {
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		white-space: nowrap;
		text-align: center;
		font-weight: 600;
	}
	.year-nav {
		display: grid;
		grid-template-columns: 2rem minmax(0, 1fr) 2rem;
		align-items: center;
		text-align: center;
		margin-bottom: 0.5rem;
	}
	.month-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.5rem;
	}
	.month-option {
		min-height: 2.5rem;
		border: 1px solid var(--cg-border-outline);
		border-radius: var(--cg-radius-control, 0.5rem);
		background: var(--cg-bg-surface);
		color: var(--cg-text-primary);
		font: inherit;
	}
	.month-option[aria-pressed='true'] {
		background: var(--cg-accent);
		color: var(--cg-text-on-accent);
	}
	.calendar-grid {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 0.125rem;
		text-align: center;
	}
	.weekday {
		padding-block: 0.25rem;
		color: var(--cg-text-muted);
		font-size: 0.75rem;
	}
	.day {
		min-width: 0;
		cursor: pointer;
	}
	.day.outside-month {
		color: var(--cg-text-muted);
		opacity: 0.7;
	}
	.day[aria-selected='true'] {
		background: var(--cg-accent);
		color: var(--cg-text-on-accent);
	}
	.day[aria-current='date'] {
		box-shadow: inset 0 0 0 1px var(--cg-accent);
	}
	.month-step:focus-visible,
	.month-label:focus-visible,
	.month-option:focus-visible,
	.day:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: 1px;
	}
</style>
