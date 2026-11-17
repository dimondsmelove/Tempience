<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ButtonVariant } from '$lib/ui/Button/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import DateInput from '$lib/ui/DateInput/DateInput.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';

	let {
		value,
		label,
		disabled = false,
		icon = false,
		variant,
		pressed,
		children: content,
		onchange,
		onclear
	}: {
		value: string;
		label: string;
		disabled?: boolean;
		icon?: boolean;
		variant?: ButtonVariant;
		pressed?: boolean;
		children: Snippet;
		onchange: (value: string) => void;
		onclear?: () => void;
	} = $props();
	const id = $props.id();
	let open = $state(false);
</script>

<Popover {id} {label} {disabled} {icon} {variant} {pressed} ontoggle={(isOpen) => (open = isOpen)}>
	{#snippet trigger()}{@render content()}{/snippet}
	{#snippet children(close)}
		{#if open}
			<DateInput
				inline
				{value}
				aria-label={label}
				onchange={(event) => {
					if (event.currentTarget.value) {
						onchange(event.currentTarget.value);
						close();
					}
				}}
			/>
			{#if onclear}<Button
					variant="quiet"
					disabled={!value}
					onclick={() => {
						onclear?.();
						close();
					}}>{t('intentions.removeDate')}</Button
				>{/if}
		{/if}
	{/snippet}
</Popover>
