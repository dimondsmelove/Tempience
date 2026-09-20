<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import {
		ChevronDownOutline,
		ChevronRightOutline,
		EyeOutline,
		EyeSlashOutline
	} from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColourKey, scopeColourOf } from '$lib/theme/scope-colour';
	import { KIND_ROW_LEGEND } from '$lib/model/Legend/constants';
	import { RAIL_INDENT_PX } from './constants';
	import LaneName from './LaneName.svelte';
	import type { RailRowProps } from './types';

	let {
		row,
		filters,
		disclosure,
		rowHeightPx,
		onCanvas,
		searching,
		arrangeable,
		band,
		selectedRowId,
		lit,
		veiled,
		veil,
		pulse,
		drop,
		merged,
		claimed,
		onhover,
		onpress,
		onselect,
		onselectrow,
		ontoggle,
		onrename,
		onsplit,
		onunclaim
	}: RailRowProps = $props();
	/** What a click on the row selects: a Scope, or the «Без Scope» row as one of its own; a merged row is no one Scope. */
	const target = $derived(row.scopeId ?? (row.kind === 'unscoped' ? row.id : null));
	/** The row is the one shown in the Context: its Scope, or the merged row itself (C5). */
	const selected = $derived((target ?? (row.kind === 'merged' ? row.id : null)) === selectedRowId);
	/**
	 * `n · Σ m` for a group, for a merged row — the members' direct records once, then with the
	 * roll-ups (п. 7, DP8) — and for a row that rolls a subtree up with nothing left to unfold
	 * (its children all claimed by lanes, review п. 32); `n` alone otherwise.
	 */
	const counts = $derived(
		row.hasChildren || row.kind === 'merged' || row.subtreeCount !== row.directCount
			? `${row.directCount} · Σ ${row.subtreeCount}`
			: String(row.directCount)
	);
</script>

<li
	class={[
		'flex items-center gap-1 overflow-hidden border-b border-outline pr-2 text-sm whitespace-nowrap',
		row.kind === 'unscoped' ? 'text-muted' : 'text-ink',
		selected && 'bg-accent/10',
		onCanvas && 'canvas-row',
		drop === 'source' && 'opacity-30',
		drop === 'merge' && 'drop-merge',
		veiled && 'veiled'
	]}
	style:height="{rowHeightPx}px"
	style:padding-left="min(25%, calc(0.5rem + {row.depth * RAIL_INDENT_PX}px))"
	style:--rail-veil={1 - veil}
	data-row-id={row.id}
	data-depth={row.depth}
	data-band={band}
	data-drop={drop === 'merge' ? 'merge' : undefined}
	data-lit={lit ? 'true' : undefined}
	data-veiled={veiled ? 'true' : undefined}
	data-pulse={pulse ? 'true' : undefined}
	onpointerenter={onhover}
	onpointerdown={onpress}
>
	{#if arrangeable}<span class="grip shrink-0" aria-hidden="true" data-handle></span>{/if}
	<!-- The chevron: a group's children, or a merged row's members beneath it (C5); the search
	     unfolds the tree on its own, a merged row folds as it likes. -->
	{#if row.hasChildren}
		<button
			type="button"
			class="shrink-0 rounded-[var(--cg-radius-control)] py-2 focus-visible:outline-2 focus-visible:outline-accent"
			aria-label={row.kind === 'merged'
				? row.expanded
					? t('rail.foldRow', { name: row.name })
					: t('rail.unfoldRow', { name: row.name })
				: row.expanded
					? t('rail.fold', { name: row.name })
					: t('rail.unfold', { name: row.name })}
			aria-expanded={row.expanded}
			disabled={searching && row.kind !== 'merged'}
			title={searching && row.kind !== 'merged' ? t('rail.searchUnfolded') : row.name}
			data-testid={row.kind === 'merged' ? 'rail-row-toggle' : undefined}
			onclick={() => (row.kind === 'merged' ? ontoggle() : disclosure.toggle(row.id))}
		>
			{#if row.expanded}<ChevronDownOutline class="h-4 w-4 shrink-0" />
			{:else}<ChevronRightOutline class="h-4 w-4 shrink-0" />{/if}
		</button>
	{:else}<span class="w-4 shrink-0"></span>{/if}
	<!-- One dot per Scope of the row with a colour: a merged row shows all its members' (п. 7). -->
	{#each row.colours as colour, index (`${index}:${scopeColourKey(colour)}`)}
		<span
			class="scope-dot shrink-0"
			style:background={scopeColourOf(colour, appearance.scopeBase)}
			data-testid="scope-dot"
			data-color-hue={colour.hue}
			data-color-chroma={colour.chroma ?? undefined}
			data-color-depth={colour.depth ?? undefined}
			aria-hidden="true"
		></span>
	{/each}
	{#if target !== null}
		<button
			type="button"
			class={[
				'min-w-0 flex-1 truncate py-2 text-left focus-visible:outline-2 focus-visible:outline-accent',
				arrangeable && 'handle',
				lit ? 'font-semibold' : row.kind === 'unscoped' ? 'font-normal' : 'font-medium',
				pulse && 'pulse'
			]}
			aria-label={t('rail.select', { name: row.name })}
			aria-pressed={selected}
			data-handle={arrangeable ? '' : undefined}
			onclick={() => onselect(target)}>{row.name}</button
		>
	{:else if merged}
		<LaneName
			name={row.name}
			autoName={merged.autoName}
			ownerName={merged.ownerName}
			composition={merged.composition}
			{lit}
			{pulse}
			handle={arrangeable}
			{selected}
			onselect={onselectrow}
			{onrename}
		/>
	{:else}<span
			class={['min-w-0 flex-1 truncate', lit && 'font-semibold', pulse && 'pulse']}
			title={row.name}>{row.name}</span
		>{/if}
	{#if !onCanvas}
		<span
			class="shrink-0 font-mono text-xs text-muted"
			data-testid="scope-count"
			title={row.kind === 'merged'
				? t('rail.mergedCounts', { direct: row.directCount, subtree: row.subtreeCount })
				: row.kind === 'scope' || row.kind === 'unscoped'
					? t('rail.scopeCounts', { direct: row.directCount, subtree: row.subtreeCount })
					: t('rail.kindCounts', { direct: row.directCount })}
		>
			{counts}
		</span>
		{#if merged}
			<!-- «×» splits the merged row back into its members, in its place (п. 7; Q4-A: an explicit split). -->
			<Button
				size="sm"
				variant="quiet"
				icon
				class="shrink-0"
				aria-label={t('rail.splitRow', { name: row.name })}
				title={t('rail.split')}
				data-testid="rail-split"
				onclick={onsplit}>×</Button
			>
		{:else if row.scopeId}
			{#if claimed}
				<!-- «↩»: a child placed alone as a lane goes back under its parent (review 2026-09-19, п. 32). -->
				<Button
					size="sm"
					variant="quiet"
					icon
					class="shrink-0"
					aria-label={t('rail.unclaimScope', { name: row.name })}
					title={t('rail.unclaim')}
					data-testid="rail-unclaim"
					onclick={onunclaim}>↩</Button
				>
			{/if}
			<Button
				size="sm"
				variant="quiet"
				icon
				class="shrink-0"
				aria-label={t('rail.hideScope', { name: row.name })}
				title={t('rail.hideSubtree')}
				onclick={() => filters.hideScope(row.scopeId!)}><EyeOutline class="h-4 w-4" /></Button
			>
		{:else if row.kind !== 'unscoped' && row.kind !== 'scope' && row.kind !== 'merged'}
			<Button
				size="sm"
				variant="quiet"
				icon
				class="shrink-0"
				aria-label={filters.isShown(KIND_ROW_LEGEND[row.kind])
					? t('rail.hideKind', { name: row.name })
					: t('rail.showKind', { name: row.name })}
				pressed={!filters.isShown(KIND_ROW_LEGEND[row.kind])}
				onclick={() => {
					if (row.kind !== 'scope' && row.kind !== 'unscoped' && row.kind !== 'merged')
						filters.toggleLegend(KIND_ROW_LEGEND[row.kind]);
				}}
			>
				{#if filters.isShown(KIND_ROW_LEGEND[row.kind])}<EyeOutline class="h-4 w-4" />
				{:else}<EyeSlashOutline class="h-4 w-4" />{/if}
			</Button>
		{/if}
	{/if}
</li>

<style>
	/* The Scope's colour before its name (loop 005, п. 1; R1 hue rule): radius 4 as in the mock; none when the Scope has no hue. */
	.scope-dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
	}
	/* Drag (C2, mock v6.2): a 2×3 grip of dots at the left; the grip and the name take the row. */
	.grip {
		width: 7px;
		height: 11px;
		background-image: radial-gradient(circle, var(--cg-text-muted) 1px, transparent 1.3px);
		background-size: 4px 4px;
		opacity: 0.55;
	}
	.grip,
	.handle {
		cursor: grab;
	}
	/* The lens veil (loop 008, B): a row the lens does not name fades to 1 − strength over 120 ms; the named stay at 1. */
	li {
		transition: opacity 120ms ease-out;
	}
	.veiled {
		opacity: var(--rail-veil);
	}
	/* «Куда смотреть» (loop 008, C3): the name flashes once — a tint of the muted accent that fades over 600 ms. */
	li :global(.pulse) {
		animation: rail-pulse 600ms ease-out 1;
		border-radius: var(--cg-radius-control);
	}
	@keyframes rail-pulse {
		from {
			background-color: var(--cg-accent-muted);
		}
		to {
			background-color: transparent;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		li {
			transition: none;
		}
		li :global(.pulse) {
			animation: none;
		}
	}
	/* The merge target: the row tinted with the accent, as the mock's panel highlight (12 %). */
	.drop-merge {
		background: color-mix(in srgb, var(--cg-accent) 12%, transparent);
		box-shadow: inset 0 0 0 1px var(--cg-accent);
	}

	/* The twin of the names on the phone's canvas: no borders, a fade into the marks. */
	.canvas-row {
		border: 0;
		padding-right: 0.75rem;
		background: linear-gradient(
			to right,
			var(--cg-bg-canvas) 0%,
			color-mix(in srgb, var(--cg-bg-canvas) 90%, transparent) 75%,
			transparent
		);
	}
	.canvas-row button {
		pointer-events: auto;
		min-height: 44px;
	}
	.canvas-row button:first-child {
		min-width: 24px;
	}
</style>
