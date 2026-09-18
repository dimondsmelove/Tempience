<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import { SvelteDate } from 'svelte/reactivity';
	import { Datepicker, type DateOrRange } from 'flowbite-svelte';
	import { CALENDAR_CLASSES } from '$lib/ui/DateInput/constants';
	import TimeWheel from './TimeWheel.svelte';
	import DatePrecisionWheel from './DatePrecisionWheel.svelte';
	import { addDays, dayAt } from './TimeInput';
	import { dateTimeFormat, LOCALE_TAGS } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { WHEEL_DAY_RADIUS } from './constants';
	import type { TimeInputState } from './TimeInputState.svelte';
	let { picker, children }: { picker: TimeInputState; children: Snippet } = $props();
	let anchor = $state(untrack(() => dayAt(picker.point)));
	const value = $derived(new SvelteDate(dayAt(picker.point)));
	const options = $derived(
		Array.from({ length: WHEEL_DAY_RADIUS * 2 + 1 }, (_, i) => {
			const value = addDays(anchor, i - WHEEL_DAY_RADIUS);
			return {
				value,
				label: dateTimeFormat(locale.current, {
					day: 'numeric',
					month: 'short',
					weekday: 'short'
				}).format(value)
			};
		})
	);
	function select(day: number | null) {
		if (day === null) return;
		picker.chooseDay(day);
		const index = options.findIndex((option) => option.value === day);
		if (index < 8 || index > options.length - 9) anchor = dayAt(day);
	}
	function calendar(day: DateOrRange) {
		if (!(day instanceof Date)) return;
		select(day.getTime());
		anchor = dayAt(picker.point);
	}
</script>

<div class="picker-navigation">
	<button
		type="button"
		aria-expanded={picker.calendar}
		data-testid="picker-calendar"
		onclick={() => (picker.calendar = !picker.calendar)}
	>
		{dateTimeFormat(locale.current, { month: 'long', year: 'numeric' }).format(picker.point)}
		<span>▦</span>
	</button>
	<button
		type="button"
		class="picker-today"
		onclick={() => {
			picker.chooseDay(dayAt(Date.now()));
			anchor = dayAt(picker.point);
		}}>{t('time.today')}</button
	>
	<button
		type="button"
		class="picker-today"
		data-testid="picker-now"
		onclick={() => {
			picker.now();
			anchor = dayAt(picker.point);
		}}>{t('time.now')}</button
	>
</div>
<div class={['picker-columns', picker.calendar && 'calendar-columns']}>
	{#if picker.calendar}
		<div class="time-picker-calendar" data-testid="picker-calendar-grid">
			<Datepicker
				inline
				locale={LOCALE_TAGS[locale.current]}
				firstDayOfWeek={1}
				{value}
				classes={{
					...CALENDAR_CLASSES,
					grid: 'grid grid-cols-7 w-full',
					dayButton: 'h-11 min-h-11 p-0'
				}}
				onselect={calendar}
			/>
			<button type="button" class="back-to-days" onclick={() => (picker.calendar = false)}
				>{t('time.toDayWheel')}</button
			>
		</div>
	{:else if picker.unplaced}
		<button type="button" class="date-only-hint" onclick={() => (picker.calendar = true)}
			>{t('time.setDate')}</button
		>
	{:else if picker.draft.date}
		<DatePrecisionWheel {picker} />
	{:else}
		<TimeWheel
			label={t('time.day')}
			{options}
			value={dayAt(picker.point)}
			compact
			onchange={select}
		/>
	{/if}
	{@render children()}
</div>
