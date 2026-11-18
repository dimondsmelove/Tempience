<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ButtonVariant } from '$lib/ui/Button/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import DateCalendar from '$lib/ui/DateInput/DateCalendar.svelte';
	import { calendarDate, localDateValue } from '$lib/ui/DateInput/DateInput';
	import Button from '$lib/ui/Button/Button.svelte';
	import MobileSheet from '$lib/ui/MobileSheet/MobileSheet.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	let {
		value,
		label,
		today = localDateValue(new Date()),
		disabled = false,
		icon = false,
		variant,
		pressed,
		children: content,
		onpick,
		onclear
	}: {
		value: string;
		label: string;
		today?: string;
		disabled?: boolean;
		icon?: boolean;
		variant?: ButtonVariant;
		pressed?: boolean;
		children?: Snippet;
		onpick: (day: string) => void;
		onclear?: () => void;
	} = $props();
	const id = $props.id();
	let width = $state(1024);
	let open = $state(false);
	const isMobile = $derived(width <= 800);
	function pick(date: Date, close?: () => void) {
		onpick(localDateValue(date));
		open = false;
		close?.();
	}
	function clear(close?: () => void) {
		onclear?.();
		open = false;
		close?.();
	}
</script>

<svelte:window bind:innerWidth={width} />
{#snippet trigger()}
	{#if content}{@render content()}{:else}<span aria-hidden="true">▦</span>{/if}
{/snippet}
{#snippet panel(close?: () => void)}
	<div class="day-picker" aria-label={label}>
		<DateCalendar
			value={value ? calendarDate(value) : undefined}
			todayKey={today}
			dayButtonClass={isMobile ? 'h-11 min-h-11 p-0' : 'h-8 min-h-8 p-0'}
			onselect={(date) => pick(date, close)}
		/>
		{#if value && onclear}
			<Button variant="quiet" onclick={() => clear(close)}>{t('intentions.removeDate')}</Button>
		{/if}
	</div>
{/snippet}

{#if isMobile}
	<Button
		variant={variant ?? 'quiet'}
		size="sm"
		{icon}
		{disabled}
		{pressed}
		aria-label={label}
		aria-haspopup="dialog"
		aria-expanded={open}
		onclick={() => (open = true)}>{@render trigger()}</Button
	>
	{#if open}<MobileSheet {label} onclose={() => (open = false)}>{@render panel()}</MobileSheet>{/if}
{:else}
	<Popover
		{id}
		{label}
		{disabled}
		{icon}
		{variant}
		{pressed}
		ontoggle={(value) => (open = value)}
		{trigger}
		children={panel}
	/>
{/if}

<style>
	.day-picker {
		width: min(20rem, calc(100vw - 2rem));
		max-width: 100%;
		padding: 0.75rem;
	}
	@media (max-width: 800px) {
		.day-picker {
			width: 100%;
			padding: 0.875rem 1rem calc(1rem + env(safe-area-inset-bottom));
		}
	}
</style>
