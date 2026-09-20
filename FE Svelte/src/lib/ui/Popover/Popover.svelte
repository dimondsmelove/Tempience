<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { overlayScrollbar } from '$lib/ui/Scrollbar';
	import { positionPopover } from './position';
	import type { PopoverProps } from './types';
	let {
		id,
		label,
		trigger,
		children,
		testId,
		class: className,
		icon = false,
		haspopup,
		title
	}: PopoverProps = $props();
	const close = () => document.getElementById(id)?.hidePopover();
</script>

<Button
	size="sm"
	variant="quiet"
	{icon}
	class={className}
	aria-label={label}
	aria-haspopup={haspopup}
	{title}
	popovertarget={id}
	data-testid={testId}
>
	{@render trigger()}
</Button>
<!-- A popover taller than the viewport scrolls under the shared overlay bar, as every surface
     does (DESIGN.md §7; loop 008, C7): the native bar never shows on the Time surface. -->
<div
	{id}
	popover="auto"
	class="cg-popover popover border border-outline bg-surface text-ink"
	aria-label={label}
	{@attach positionPopover}
	{@attach overlayScrollbar}
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
