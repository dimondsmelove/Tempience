<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { positionPopover } from './position';
	import type { PopoverProps } from './types';
	let { id, label, trigger, children, testId, class: className }: PopoverProps = $props();
	const close = () => document.getElementById(id)?.hidePopover();
</script>

<Button
	size="sm"
	variant="quiet"
	class={className}
	aria-label={label}
	popovertarget={id}
	data-testid={testId}
>
	{@render trigger()}
</Button>
<div
	{id}
	popover="auto"
	class="cg-popover popover border border-outline bg-surface text-ink"
	aria-label={label}
	{@attach positionPopover}
>
	{@render children(close)}
</div>

<style>
	.popover {
		position: fixed;
		inset: auto;
		margin: 0;
		width: max-content;
		max-width: calc(100vw - 1rem);
		max-height: calc(100dvh - 1rem);
		overflow: auto;
	}
</style>
