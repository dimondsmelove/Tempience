<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import Button from '$lib/ui/Button/Button.svelte';
	import { nearestPosition, sheetHeights } from './geometry';
	import { SHEET_POSITIONS } from './constants';
	import { sheetDrag } from './drag';
	import type { BottomSheetProps } from './types';

	let {
		label,
		position = 'half',
		modal = false,
		heading = true,
		measuredHeight = $bindable(0),
		onposition,
		onclose,
		children
	}: BottomSheetProps = $props();
	let available = $state(600);
	let bottom = $state(64);
	let rem = $state(16);
	let dragHeight = $state<number | null>(null);
	const heights = $derived(sheetHeights(available, rem));
	const height = $derived(dragHeight ?? heights[position]);

	const measure: Attachment<HTMLElement> = (element) => {
		const parent = element.parentElement!;
		const update = () => {
			const rect = parent.getBoundingClientRect();
			const visual = window.visualViewport;
			rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
			const bar =
				parent.querySelector<HTMLElement>('[data-testid="mobile-actions"]')?.offsetHeight ?? 64;
			const inset = Math.max(
				0,
				rect.bottom - (visual ? visual.offsetTop + visual.height : innerHeight)
			);
			bottom = Math.max(bar, inset);
			available = Math.max(0, rect.height - bottom);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(parent);
		window.visualViewport?.addEventListener('resize', update);
		window.visualViewport?.addEventListener('scroll', update);
		return () => {
			observer.disconnect();
			window.visualViewport?.removeEventListener('resize', update);
			window.visualViewport?.removeEventListener('scroll', update);
		};
	};

	const manageFocus: Attachment<HTMLElement> = (element) => {
		if (!modal) return;
		const previous = document.activeElement as HTMLElement | null;
		const frame = requestAnimationFrame(() => element.focus({ preventScroll: true }));
		return () => {
			cancelAnimationFrame(frame);
			if (previous?.isConnected) previous.focus({ preventScroll: true });
		};
	};
	const onkeydown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') {
			if ((event.currentTarget as HTMLElement).querySelector('[popover]:popover-open')) return;
			event.preventDefault();
			event.stopPropagation();
			onclose();
		} else if (modal && event.key === 'Tab') {
			const root = event.currentTarget as HTMLElement;
			const controls = [
				...root.querySelectorAll<HTMLElement>(
					'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
				)
			].filter((el) => el.getClientRects().length > 0);
			const first = controls[0],
				last = controls.at(-1);
			if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
				event.preventDefault();
				last?.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first?.focus();
			}
		}
	};
	const drag = sheetDrag({
		getLimit: () => available,
		ondrag: (next) => (dragHeight = next),
		onrelease: (nextHeight, velocity) => {
			const next = nearestPosition(nextHeight, heights, velocity);
			if (next === null) onclose();
			else onposition?.(next);
		}
	});
	const ongripkey = (event: KeyboardEvent) => {
		const direction = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
		if (!direction) return;
		event.preventDefault();
		const index = SHEET_POSITIONS.indexOf(position) + direction;
		if (index < 0) onclose();
		else onposition?.(SHEET_POSITIONS[Math.min(index, SHEET_POSITIONS.length - 1)]);
	};
</script>

{#if modal}<button
		class="sheet-scrim"
		aria-label={`Закрыть ${label}`}
		tabindex="-1"
		onclick={onclose}
	></button>{/if}
<section
	class={[
		'bottom-sheet border border-outline bg-surface text-ink',
		dragHeight !== null && 'dragging'
	]}
	role={modal ? 'dialog' : 'region'}
	aria-modal={modal || undefined}
	aria-label={label}
	tabindex="-1"
	bind:clientHeight={measuredHeight}
	data-testid="bottom-sheet"
	data-position={position}
	style:height="{height}px"
	style:bottom="{bottom}px"
	{onkeydown}
	{@attach drag}
	{@attach measure}
	{@attach manageFocus}
>
	<button
		class="sheet-grip"
		aria-label={`Высота ${label}: ${position}`}
		data-sheet-drag-handle
		onkeydown={ongripkey}
		onclick={() =>
			onposition?.(position === 'peek' ? 'half' : position === 'half' ? 'full' : 'half')}
	>
		<span></span>
	</button>
	{#if heading}<header
			data-sheet-drag-handle
			class="flex shrink-0 items-center justify-between gap-2 border-b border-outline px-3 pb-2"
		>
			<h2 class="font-semibold">{label}</h2>
			<Button icon variant="quiet" aria-label={`Закрыть ${label}`} onclick={onclose}>×</Button>
		</header>{/if}
	<div class="sheet-content">{@render children()}</div>
</section>

<style>
	.bottom-sheet {
		position: absolute;
		inset-inline: 0;
		z-index: 40;
		display: flex;
		flex-direction: column;
		min-height: 0;
		border-radius: var(--cg-radius-surface) var(--cg-radius-surface) 0 0;
		box-shadow: var(--cg-shadow);
		transition: height 180ms ease;
		overflow: hidden;
	}
	.bottom-sheet.dragging {
		transition: none;
	}
	.sheet-scrim {
		position: absolute;
		inset: 0;
		z-index: 35;
		background: color-mix(in srgb, var(--cg-bg-canvas) 55%, transparent);
	}
	.sheet-grip {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 44px;
		flex: 0 0 auto;
	}
	.bottom-sheet :global([data-sheet-drag-handle]) {
		touch-action: none;
		user-select: none;
		cursor: ns-resize;
	}
	.sheet-grip span {
		width: 2.5rem;
		height: 4px;
		border-radius: 4px;
		background: var(--cg-border-default);
	}
	.sheet-content {
		min-height: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: auto;
		overscroll-behavior: contain;
		--time-header-height: 0px;
	}
	@media (prefers-reduced-motion: reduce) {
		.bottom-sheet {
			transition: none;
		}
	}
</style>
