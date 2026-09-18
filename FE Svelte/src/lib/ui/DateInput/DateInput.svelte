<script lang="ts">
	import { Datepicker, type DateOrRange } from 'flowbite-svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import { calendarDate, selectedDateValue } from './DateInput';
	import { LOCALE_TAGS } from '$lib/state/Locale/format';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { CALENDAR_CLASSES } from './constants';
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
	<div class="calendar min-w-0" data-testid="date-calendar">
		<Datepicker
			inline
			locale={LOCALE_TAGS[locale.current]}
			firstDayOfWeek={1}
			value={calendarDate(value)}
			classes={CALENDAR_CLASSES}
			onselect={(date) => {
				select(date);
				close?.();
			}}
		/>
	</div>
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
	.calendar {
		width: min(17rem, calc(100vw - 4rem));
		max-width: 100%;
	}
	.calendar > :global(div) {
		display: block !important;
		width: 100%;
	}
	.calendar :global([role='dialog']) {
		width: 100%;
		padding: 0 !important;
		box-shadow: none;
		background: var(--cg-bg-surface) !important;
		color: var(--cg-text-primary) !important;
	}
	.calendar :global(button) {
		background: var(--cg-bg-surface) !important;
		color: var(--cg-text-primary) !important;
		border: 0 !important;
		padding: 0 !important;
		min-height: 2rem;
	}
	.calendar :global(button:hover) {
		background: var(--cg-bg-raised) !important;
	}
	.calendar :global([role='columnheader']) {
		color: var(--cg-text-muted);
	}
	.calendar :global(button[aria-selected='true']) {
		background: var(--cg-accent) !important;
		color: var(--cg-text-on-accent) !important;
	}
	.calendar :global(button:focus-visible) {
		outline: 2px solid var(--cg-accent);
		outline-offset: 1px;
	}
</style>
