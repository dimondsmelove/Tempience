<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { positionPopover } from '$lib/ui/Popover/position';
	import { SWATCH_SIZE_PX } from './constants';
	import type { BlossomPopoverProps } from './types';

	let {
		id,
		label,
		readout,
		colour,
		name,
		variant = 'field',
		size = SWATCH_SIZE_PX,
		disabled = false,
		testId,
		data,
		children
	}: BlossomPopoverProps = $props();
	let open = $state(false);
	/**
	 * Follows the native popover's state; a close that leaves the focus nowhere (Escape after a
	 * click on the arc, «без цвета» by keyboard) hands it back to the swatch, the panel's
	 * previous sibling — the anchor `positionPopover` reads too.
	 */
	const follow: Attachment<HTMLElement> = (panel) => {
		const ontoggle = (event: Event): void => {
			open = (event as ToggleEvent).newState === 'open';
			if (open) return;
			const active = document.activeElement;
			if (active === null || active === document.body || panel.contains(active))
				(panel.previousElementSibling as HTMLElement | null)?.focus();
		};
		panel.addEventListener('toggle', ontoggle);
		return () => panel.removeEventListener('toggle', ontoggle);
	};
</script>

<!-- The colour field is a dot (owner review 2026-09-19, pack 3, P1): a round swatch of the colour
     picked — an empty ink ring without one — that opens the flower in a native popover over the
     form, beside itself. The popover owns Escape and the click outside; a pick applies at once
     and leaves it open, so the arc can be dragged. The colour's words are the swatch's name.
     As a `dot` (C6, the Context Scope's 12 px dot) the swatch is the plain dot of the ribbon,
     ringed only under the pointer, the focus or while open; without a colour it is transparent
     and keeps its slot, a faint ink ring under the pointer or the focus. -->
<button
	type="button"
	class={[
		'swatch',
		variant === 'dot' ? 'swatch-dot' : 'swatch-field',
		colour === null && 'swatch-none',
		open && 'swatch-open'
	]}
	style:--dot={colour ?? 'transparent'}
	style:--size="{size}px"
	popovertarget={id}
	aria-haspopup="dialog"
	aria-expanded={open}
	aria-label={name ?? `${label}: ${readout}`}
	title={name ?? readout}
	{disabled}
	data-testid={testId ? `${testId}-swatch` : undefined}
	data-open={open ? 'true' : undefined}
	{...data}
></button>
<div
	{id}
	popover="auto"
	role="dialog"
	class="cg-popover panel border border-outline bg-surface text-ink"
	aria-label={label}
	data-testid={testId ? `${testId}-popover` : undefined}
	{@attach positionPopover}
	{@attach follow}
>
	{#if open}{@render children()}{/if}
</div>

<style>
	.swatch {
		width: var(--size);
		height: var(--size);
		flex: none;
		padding: 0;
		border: 0;
		border-radius: 9999px;
		background: var(--dot);
		cursor: pointer;
	}
	.swatch-field {
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--cg-text-primary) 25%, transparent);
	}
	/* «Без цвета»: the empty ink ring of the ribbon's colourless mark. */
	.swatch-field.swatch-none {
		background: transparent;
		box-shadow: none;
		border: var(--cg-border-width) solid var(--cg-text-primary);
	}
	.swatch:hover,
	.swatch-open {
		box-shadow:
			0 0 0 2px var(--cg-bg-surface),
			0 0 0 3px var(--cg-text-primary);
	}
	/* The dot without a colour: nothing at rest, a faint ink ring under the pointer or the focus. */
	.swatch-dot.swatch-none:hover,
	.swatch-dot.swatch-none:focus-visible,
	.swatch-dot.swatch-none.swatch-open {
		box-shadow: 0 0 0 1px color-mix(in srgb, var(--cg-text-primary) 30%, transparent);
	}
	.swatch:focus-visible {
		outline: 2px solid var(--cg-focus);
		outline-offset: 2px;
	}
	.swatch:disabled {
		cursor: default;
		opacity: 0.5;
	}
	.panel {
		position: fixed;
		inset: auto;
		margin: 0;
		width: max-content;
		max-width: calc(100vw - 1rem);
		max-height: calc(100dvh - 1rem);
		overflow: auto;
	}
</style>
