<script lang="ts">
	import { appearance } from '$lib/theme/appearance.svelte';
	import { panelWidths } from '$lib/theme/resolve-appearance';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import BottomSheet from '$lib/ui/BottomSheet/BottomSheet.svelte';
	import PanelHeader from '$lib/ui/PanelHeader/PanelHeader.svelte';
	import type { SheetPosition } from '$lib/ui/BottomSheet/types';
	import PanelResize from '$lib/ui/PanelResize/PanelResize.svelte';
	import { overlayScrollbar } from '$lib/ui/Scrollbar';
	import type { SidePanelProps } from './types';

	let {
		open,
		title,
		canBack,
		canForward,
		position,
		onback,
		onforward,
		onclose,
		below = '[data-testid="identity-bar"]',
		children
	}: SidePanelProps = $props();
	let panel: HTMLElement;
	let width = $state(1024);
	let sheetPosition = $state<SheetPosition>('half');
	let top = $state(0);
	const contextWidth = $derived(
		panelWidths(width, { ...appearance.device, contextOpen: true }).context
	);
	$effect(() => {
		if (!open) return;
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const frame = requestAnimationFrame(() => panel?.focus({ preventScroll: true }));
		return () => {
			cancelAnimationFrame(frame);
			if (previous?.isConnected) previous.focus({ preventScroll: true });
		};
	});
	const measure = () => {
		top = document.querySelector(below)?.getBoundingClientRect().bottom ?? 0;
	};
	const init = () => {
		measure();
		const observer = new ResizeObserver(measure);
		const header = document.querySelector(below);
		if (header) observer.observe(header);
		window.addEventListener('scroll', measure, true);
		return () => {
			observer.disconnect();
			window.removeEventListener('scroll', measure, true);
		};
	};
	const keydown = (event: KeyboardEvent) => {
		if (
			event.key === 'Escape' &&
			!event.defaultPrevented &&
			!panel.querySelector('[popover]:popover-open')
		) {
			event.stopPropagation();
			onclose();
		}
	};
</script>

<svelte:window bind:innerWidth={width} onresize={measure} />
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<aside
	id="intentions-side-panel"
	class:open
	class="context-panel"
	role="dialog"
	aria-label={title}
	tabindex="-1"
	inert={!open}
	bind:this={panel}
	style:top={width >= 1024 ? `${top}px` : '0px'}
	style:--panel-width="{contextWidth}px"
	{@attach init}
	onkeydown={keydown}
>
	{#if width >= 1024}<PanelResize
			label={t('panel.contextWidth')}
			controls="intentions-side-panel"
			value={contextWidth}
			min={240}
			max={600}
			side="left"
			onpreview={(value) =>
				appearance.previewDevice({ ...appearance.savedDevice, contextWidth: value })}
			oncommit={() => appearance.applyDevice({ ...appearance.device })}
			oncancel={() => appearance.cancel()}
		/>{/if}
	{#if width < 1024}
		{#if open}
			<BottomSheet
				label={title}
				position={sheetPosition}
				heading={false}
				bottomOffset={0}
				onposition={(next) => (sheetPosition = next)}
				{onclose}
			>
				{@render content(true)}
			</BottomSheet>
		{/if}
	{:else}
		{@render content(false)}
	{/if}
</aside>

{#snippet content(dragHandle: boolean)}
	<PanelHeader
		{title}
		{position}
		{canBack}
		{canForward}
		{onback}
		{onforward}
		{onclose}
		{dragHandle}
	/>
	<div class="cg-panel flex min-h-0 flex-1 flex-col gap-3 overflow-auto" {@attach overlayScrollbar}>
		{@render children()}
	</div>
{/snippet}

<style>
	.context-panel {
		position: fixed;
		right: 0;
		bottom: 0;
		z-index: 30;
		display: flex;
		min-height: 0;
		flex-direction: column;
		width: var(--panel-width);
		background: var(--cg-bg-canvas);
		border-left: 1px solid var(--cg-border-default);
		visibility: hidden;
		transform: translateX(100%);
		opacity: 0;
		transition:
			transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 160ms,
			visibility 0s 220ms;
	}
	.context-panel.open {
		visibility: visible;
		transform: translateX(0);
		opacity: 1;
		transition:
			transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
			opacity 160ms,
			visibility 0s;
	}
	@media (max-width: 1023px) {
		.context-panel,
		.context-panel.open {
			left: 0;
			width: 100%;
			border: 0;
			background: transparent;
			pointer-events: none;
			transform: none;
			transition: none;
		}
		.context-panel :global(.bottom-sheet) {
			pointer-events: auto;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.context-panel,
		.context-panel.open {
			transition: none;
		}
	}
</style>
