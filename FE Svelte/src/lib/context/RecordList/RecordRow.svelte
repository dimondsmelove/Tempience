<script lang="ts">
	import { getLens, lensSource } from '$lib/ui/LensSource';
	import RecordMark from './RecordMark.svelte';
	import type { RecordRowProps } from './types';

	let { item, testId, lit = false, titleClass = 'text-sm', onselect }: RecordRowProps = $props();
	/** The workbench's hover: a record row lights its record on the ribbon (loop 008, C3). */
	const hover = getLens();
</script>

<!-- One record on one line: the ribbon's mark in its Scope's colour, the title, the day at the
     end in the axis's mono; a click opens it, the pointer lights it on the ribbon. -->
<button
	type="button"
	class={['row', item.mark && 'marked', lit && 'lit']}
	data-testid={testId}
	data-trace-id={item.traceId}
	data-lit={lit ? 'true' : undefined}
	onclick={() => onselect(item.traceId)}
	{@attach lensSource(hover, { kind: 'trace', traceId: item.traceId })}
>
	{#if item.mark}<span class="lead"><RecordMark {...item.mark} /></span>{/if}
	<span class={['title', titleClass || undefined]}>{item.title}</span>
	<span class="date font-mono text-xs text-muted">{item.date}</span>
</button>

<style>
	.row {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: baseline;
		column-gap: 10px;
		width: 100%;
		padding: 4px 8px;
		border-radius: var(--cg-radius-control);
		text-align: left;
		color: var(--cg-text-primary);
		cursor: pointer;
		font-size: var(--cg-text-size-body-sm, 14px);
		line-height: 1.3;
	}
	.row.marked {
		grid-template-columns: 16px minmax(0, 1fr) auto;
	}
	.row:hover {
		background: color-mix(in oklab, var(--cg-accent) 10%, transparent);
	}
	.row:focus-visible {
		outline: 2px solid var(--cg-accent);
	}
	.lead {
		align-self: center;
		display: flex;
	}
	.title {
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		overflow: hidden;
	}
	.date {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	/* The emphasis of the hover linking (pack 3, P4): a 2 px accent underline with rounded ends
	   along the row's bottom edge, the same one the chip carries when lit; drawn inside the box,
	   so nothing reflows and what is under the pointer stays under it. */
	.lit::after {
		content: '';
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 0;
		height: 2px;
		border-radius: 1px;
		background: var(--cg-accent);
		pointer-events: none;
	}
</style>
