<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import {
		CHIP_CLASS,
		GROUP_HEADING_CLASS,
		LIST_BUTTON_CLASS,
		TOGGLE_CLASS
	} from '$lib/context/constants';
	import { formatDay, reasonKey, reasonLabel } from '$lib/context/labels';
	import { DEFAULT_NEIGHBORHOOD_OPTIONS } from '$lib/model/Neighborhood/constants';
	import { neighborhood } from '$lib/model/Neighborhood/Neighborhood';
	import type { Neighbor, NeighborhoodFilter } from '$lib/model/Neighborhood/types';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { FILTERS } from './constants';

	let { workbench, traceId }: { workbench: WorkbenchState; traceId: string } = $props();
	let filter = $state<NeighborhoodFilter>('these');
	const snapshot = $derived(workbench.view);
	const result = $derived(
		neighborhood(snapshot, traceId, { ...DEFAULT_NEIGHBORHOOD_OPTIONS, filter })
	);
	const anchor = $derived(snapshot.traces.find((trace) => trace.id === traceId));
	const scopeName = (id: string): string =>
		snapshot.scopes.find((scope) => scope.id === id)?.name ?? id;
	/**
	 * What the chips say: a distance reads with its side of the anchor, and a shared source
	 * only when it tells something — every record of the user's own space shares that one.
	 */
	const reasonsOf = (item: Neighbor) =>
		anchor?.origin.kind === 'canonical'
			? item.reasons.filter((reason) => reason.kind !== 'sharedSource')
			: item.reasons;
	const isAfter = (item: Neighbor): boolean =>
		Boolean(item.time && result?.anchorTime && item.time.start > result.anchorTime.start);
</script>

{#snippet row(item: Neighbor)}
	<li>
		<button
			type="button"
			class={LIST_BUTTON_CLASS}
			data-testid="neighbor"
			onclick={() => workbench.selectTrace(item.traceId, 'context')}
		>
			<span class="font-mono text-xs text-muted"
				>{item.time ? formatDay(item.time.start) : t('neighborhood.undated')}</span
			>
			<span>{item.label}</span>
			<span class="flex flex-wrap gap-1">
				{#each reasonsOf(item) as reason (reasonKey(reason))}
					<span class={CHIP_CLASS}>{reasonLabel(reason, scopeName, isAfter(item))}</span>
				{/each}
			</span>
		</button>
	</li>
{/snippet}

<!-- A one-off, explainable list around the anchor; a click re-anchors (DESIGN.md §8, DP14). -->
<section class="flex flex-col gap-2" data-testid="context-neighborhood">
	<div role="group" aria-label={t('neighborhood.scopes')} class="flex gap-1">
		{#each FILTERS as [value, label] (value)}
			<button
				type="button"
				class={TOGGLE_CLASS}
				aria-pressed={filter === value}
				onclick={() => (filter = value)}>{t(label)}</button
			>
		{/each}
	</div>
	{#if result}
		<ol class="flex flex-col gap-1" aria-label={t('neighborhood.byTime')}>
			{#each result.before as item (item.traceId)}{@render row(item)}{/each}
			<li class="rounded-sm border border-accent bg-accent/10 px-2 py-1" aria-current="true">
				<span class="font-mono text-xs text-muted"
					>{result.anchorTime
						? formatDay(result.anchorTime.start)
						: t('neighborhood.undated')}</span
				>
				<span class="block font-medium">{anchor?.displayTitle ?? anchor?.content}</span>
			</li>
			{#each result.after as item (item.traceId)}{@render row(item)}{/each}
		</ol>
		{#if result.linked.length}
			<h3 class={GROUP_HEADING_CLASS}>{t('neighborhood.outside')}</h3>
			<ul class="flex flex-col gap-1">
				{#each result.linked as item (item.traceId)}{@render row(item)}{/each}
			</ul>
		{/if}
	{/if}
</section>
