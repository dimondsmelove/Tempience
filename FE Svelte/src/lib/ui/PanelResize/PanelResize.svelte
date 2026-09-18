<script lang="ts">
	let {
		label,
		controls,
		value,
		min,
		max,
		side,
		onpreview,
		oncommit,
		oncancel
	}: {
		label: string;
		controls: string;
		value: number;
		min: number;
		max: number;
		side: 'left' | 'right';
		onpreview: (width: number) => void;
		oncommit: () => void;
		oncancel: () => void;
	} = $props();
	let dragging = $state(false);
	let startX = 0,
		startWidth = 0;
	const clamp = (width: number) => Math.max(min, Math.min(max, Math.round(width)));
	const down = (event: PointerEvent) => {
		if (event.button !== 0) return;
		event.preventDefault();
		const handle = event.currentTarget as HTMLElement;
		handle.focus();
		handle.setPointerCapture(event.pointerId);
		startX = event.clientX;
		startWidth = value;
		dragging = true;
	};
	const move = (event: PointerEvent) => {
		if (dragging)
			onpreview(clamp(startWidth + (event.clientX - startX) * (side === 'right' ? 1 : -1)));
	};
	const commit = () => {
		if (dragging) {
			dragging = false;
			oncommit();
		}
	};
	const cancel = () => {
		if (dragging) {
			dragging = false;
			oncancel();
		}
	};
	const key = (event: KeyboardEvent) => {
		if (event.key === 'Escape' && dragging) {
			event.stopPropagation();
			cancel();
			return;
		}
		let next: number;
		if (event.key === 'Home') next = min;
		else if (event.key === 'End') next = max;
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
			next =
				value +
				(event.key === 'ArrowRight' ? 1 : -1) *
					(side === 'right' ? 1 : -1) *
					(event.shiftKey ? 40 : 8);
		else return;
		event.preventDefault();
		event.stopPropagation();
		onpreview(clamp(next));
		oncommit();
	};
</script>

<!-- A focusable separator is an ARIA widget: https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/ -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
<div
	class={['panel-resize', side, dragging && 'dragging']}
	role="separator"
	tabindex="0"
	aria-label={label}
	aria-controls={controls}
	aria-orientation="vertical"
	aria-valuemin={min}
	aria-valuemax={max}
	aria-valuenow={Math.round(value)}
	aria-valuetext={Math.round(value) + ' px'}
	onpointerdown={down}
	onpointermove={move}
	onpointerup={commit}
	onpointercancel={cancel}
	onlostpointercapture={cancel}
	onkeydown={key}
></div>

<style>
	.panel-resize {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		z-index: 15;
		cursor: col-resize;
		touch-action: none;
	}
	.right {
		right: -4px;
	}
	.left {
		left: -4px;
	}
	/* Neutral at rest and on hover; the accent appears only while dragging. */
	.panel-resize:hover {
		background: var(--cg-border-default);
	}
	.dragging {
		background: var(--cg-accent-muted);
	}
	.panel-resize:focus-visible {
		outline: 2px solid var(--cg-focus);
		outline-offset: -2px;
	}
</style>
