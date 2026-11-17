<script lang="ts">
	import type { Snippet } from 'svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import MobileSheet from '$lib/ui/MobileSheet/MobileSheet.svelte';
	let {
		id,
		label,
		icon = false,
		trigger,
		children
	}: {
		id: string;
		label: string;
		icon?: boolean;
		trigger: Snippet;
		children: Snippet<[() => void]>;
	} = $props();
	let width = $state(1024);
	let sheetOpen = $state(false);
	const close = () => {
		sheetOpen = false;
	};
</script>

<svelte:window bind:innerWidth={width} />
{#if width <= 800}
	<button
		type="button"
		aria-label={label}
		aria-haspopup="menu"
		aria-expanded={sheetOpen}
		onclick={() => (sheetOpen = true)}>{@render trigger()}</button
	>
	{#if sheetOpen}
		<MobileSheet {label} onclose={close}>
			{@render children(close)}
		</MobileSheet>
	{/if}
{:else}
	<Popover {id} {label} {icon} haspopup="menu" {trigger} {children} />
{/if}
