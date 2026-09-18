<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import {
		ChevronDownOutline,
		ChevronRightOutline,
		EyeOutline,
		EyeSlashOutline
	} from 'flowbite-svelte-icons';
	import Button from '$lib/ui/Button/Button.svelte';
	import PanelResize from '$lib/ui/PanelResize/PanelResize.svelte';
	import type { ProjectedRow } from '$lib/model/Projection/types';
	import { RAIL_INDENT_PX, RAIL_MAX_WIDTH_PX, RAIL_MIN_WIDTH_PX } from './constants';
	import type { ScopeRailProps } from './types';

	let {
		rows,
		filters,
		disclosure,
		headerHeight = $bindable(0),
		rowHeightPx,
		widthPx,
		compact,
		onCanvas = false,
		selectedScopeId,
		onselectscope,
		onclose,
		onpreview,
		oncommit,
		oncancel,
		oncreate
	}: ScopeRailProps = $props();
	const searching = $derived(Boolean(filters.scopeQuery.trim()));
	/** What a click on the row selects: a Scope, or the «Без Scope» row as one of its own. */
	const selectable = (row: ProjectedRow): string | null =>
		row.scopeId ?? (row.kind === 'unscoped' ? row.id : null);
</script>

{#if !onCanvas}
	<header
		class="sticky top-0 z-20 flex shrink-0 flex-col justify-center border-b border-outline bg-surface"
		style:min-height="var(--time-header-height)"
	>
		<div
			class="flex min-w-0 flex-col gap-1 p-2"
			bind:clientHeight={headerHeight}
			data-testid="scope-header"
		>
			<div class="flex items-stretch gap-1">
				<div
					class="cg-field cg-control cg-control-sm flex min-w-0 flex-1 items-center focus-within:outline-2 focus-within:outline-accent"
				>
					<input
						type="search"
						class="scope-search w-0 min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
						aria-label={t('rail.search')}
						placeholder={t('rail.search')}
						value={filters.scopeQuery}
						oninput={(event) => {
							filters.scopeQuery = event.currentTarget.value;
						}}
					/>
					{#if filters.scopeQuery}
						<button
							type="button"
							class="shrink-0 cursor-pointer text-muted hover:text-ink"
							aria-label={t('rail.clearSearch')}
							onclick={() => {
								filters.scopeQuery = '';
							}}>×</button
						>
					{/if}
				</div>
				{#if oncreate}
					<Button
						size="sm"
						icon
						title={t('rail.newScope')}
						aria-label={t('rail.newScope')}
						data-testid="scope-new"
						onclick={oncreate}>+</Button
					>
				{/if}
				<Button
					size="sm"
					variant="quiet"
					icon
					aria-label={t('rail.close')}
					data-testid="scope-close"
					onclick={onclose}>‹</Button
				>
			</div>
		</div>
	</header>
{/if}
<ol
	class={onCanvas ? 'canvas-names' : undefined}
	aria-label={onCanvas ? t('rail.namesOnCanvas') : t('rail.rowsOfTimeline')}
	data-testid={onCanvas ? 'scope-canvas-names' : 'scope-rail-rows'}
>
	{#each rows as row (row.id)}
		{@const target = selectable(row)}
		<li
			class={[
				'flex items-center gap-1 overflow-hidden border-b border-outline pr-2 text-sm whitespace-nowrap',
				row.kind === 'unscoped' ? 'text-muted' : 'text-ink',
				target !== null && target === selectedScopeId && 'bg-accent/10'
			]}
			style:height="{rowHeightPx}px"
			style:padding-left="min(25%, calc(0.5rem + {row.depth * RAIL_INDENT_PX}px))"
			data-row-id={row.id}
		>
			{#if row.hasChildren}
				<button
					type="button"
					class="shrink-0 rounded-[var(--cg-radius-control)] py-2 focus-visible:outline-2 focus-visible:outline-accent"
					aria-label={row.expanded
						? t('rail.fold', { name: row.name })
						: t('rail.unfold', { name: row.name })}
					aria-expanded={row.expanded}
					disabled={searching}
					title={searching ? t('rail.searchUnfolded') : row.name}
					onclick={() => disclosure.toggle(row.id)}
				>
					{#if row.expanded}<ChevronDownOutline class="h-4 w-4 shrink-0" />
					{:else}<ChevronRightOutline class="h-4 w-4 shrink-0" />{/if}
				</button>
			{:else}<span class="w-4 shrink-0"></span>{/if}
			{#if target !== null}
				<button
					type="button"
					class={[
						'min-w-0 flex-1 truncate py-2 text-left focus-visible:outline-2 focus-visible:outline-accent',
						row.kind === 'unscoped' ? 'font-normal' : 'font-medium'
					]}
					aria-label={t('rail.select', { name: row.name })}
					aria-pressed={target === selectedScopeId}
					onclick={() => onselectscope(target)}>{row.name}</button
				>
			{:else}<span class="min-w-0 flex-1 truncate" title={row.name}>{row.name}</span>{/if}
			{#if !onCanvas}
				<span
					class="shrink-0 font-mono text-xs text-muted"
					data-testid="scope-count"
					title={row.kind === 'scope' || row.kind === 'unscoped'
						? t('rail.scopeCounts', { direct: row.directCount, subtree: row.subtreeCount })
						: t('rail.kindCounts', { direct: row.directCount })}
				>
					{row.directCount}{#if row.hasChildren}
						· Σ {row.subtreeCount}{/if}
				</span>
				{#if row.scopeId}
					<Button
						size="sm"
						variant="quiet"
						icon
						class="shrink-0"
						aria-label={t('rail.hideScope', { name: row.name })}
						title={t('rail.hideSubtree')}
						onclick={() => filters.hideScope(row.scopeId!)}><EyeOutline class="h-4 w-4" /></Button
					>
				{:else if row.kind !== 'unscoped' && row.kind !== 'scope'}
					<Button
						size="sm"
						variant="quiet"
						icon
						class="shrink-0"
						aria-label={filters.isShown(row.kind)
							? t('rail.hideKind', { name: row.name })
							: t('rail.showKind', { name: row.name })}
						pressed={!filters.isShown(row.kind)}
						onclick={() => {
							if (row.kind !== 'scope' && row.kind !== 'unscoped') filters.toggleLegend(row.kind);
						}}
					>
						{#if filters.isShown(row.kind)}<EyeOutline class="h-4 w-4" />
						{:else}<EyeSlashOutline class="h-4 w-4" />{/if}
					</Button>
				{/if}
			{/if}
		</li>
	{:else}
		<li class="p-3 text-sm text-muted" role="status">
			{disclosure.grouping === 'kind'
				? t('rail.noneOnAxis')
				: searching
					? t('rail.notFound')
					: t('rail.noRows')}
		</li>
	{/each}
</ol>
{#if !compact && !onCanvas}<PanelResize
		label={t('rail.width')}
		controls="time-scope"
		value={widthPx}
		min={RAIL_MIN_WIDTH_PX}
		max={RAIL_MAX_WIDTH_PX}
		side="right"
		{onpreview}
		{oncommit}
		{oncancel}
	/>{/if}

<style>
	.scope-search {
		font: inherit;
	}
	.scope-search::-webkit-search-cancel-button {
		appearance: none;
	}

	.canvas-names {
		position: absolute;
		inset: 0 auto 0 0;
		width: 48%;
		z-index: 5;
		pointer-events: none;
	}
	.canvas-names li {
		border: 0;
		padding-right: 0.75rem;
		background: linear-gradient(
			to right,
			var(--cg-bg-canvas) 0%,
			color-mix(in srgb, var(--cg-bg-canvas) 90%, transparent) 75%,
			transparent
		);
	}
	.canvas-names button {
		pointer-events: auto;
		min-height: 44px;
	}
	.canvas-names button:first-child {
		min-width: 24px;
	}
</style>
