<script lang="ts">
	import type { DateOrRange } from 'flowbite-svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import DateCalendar from './DateCalendar.svelte';
	import { calendarDate, selectedDateValue } from './DateInput';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { DateInputProps } from './types';

	let {
		value = $bindable(''),
		type = 'date',
		inline = false,
		calendarLabel,
		disabled,
		readonly,
		class: className,
		...attributes
	}: DateInputProps = $props();
	const id = $props.id();
	let inputElement: HTMLInputElement | undefined;
	function select(date: DateOrRange) {
		if (!(date instanceof Date) || !inputElement) return;
		// Use the same input events as typing, including schema form validation handlers.
		inputElement.value = selectedDateValue(date, value, type === 'datetime-local');
		inputElement.dispatchEvent(new Event('input', { bubbles: true }));
		inputElement.dispatchEvent(new Event('change', { bubbles: true }));
	}
</script>

{#snippet calendar(close?: () => void)}
	<DateCalendar
		value={calendarDate(value)}
		onselect={(date) => {
			select(date);
			close?.();
		}}
	/>
{/snippet}

<div class="grid min-w-0 gap-2">
	<div class="flex min-w-0 items-center gap-1">
		<input
			{...attributes}
			{type}
			{disabled}
			{readonly}
			class={['cg-control cg-field min-w-0 flex-1', className]}
			bind:value
			{@attach (element) => {
				inputElement = element;
				return () => {
					inputElement = undefined;
				};
			}}
		/>
		{#if !inline && !disabled && !readonly}
			<Popover id={`${id}-calendar`} label={calendarLabel ?? t('time.openCalendar')}>
				{#snippet trigger()}<span aria-hidden="true">▦</span>{/snippet}
				{#snippet children(close)}{@render calendar(close)}{/snippet}
			</Popover>
		{/if}
	</div>
	{#if inline && !disabled && !readonly}{@render calendar()}{/if}
</div>

<style>
	input::-webkit-calendar-picker-indicator {
		display: none;
	}
</style>
