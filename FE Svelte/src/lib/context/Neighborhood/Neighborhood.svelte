<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { CHIP_CLASS, GROUP_HEADING_CLASS, LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { formatDay, reasonKey, reasonLabel } from '$lib/context/labels';
	import { neighborhood } from '$lib/model/Neighborhood/Neighborhood';
	import type { Neighbor } from '$lib/model/Neighborhood/types';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { lensSource } from '$lib/ui/LensSource';

	let { workbench, traceId }: { workbench: WorkbenchState; traceId: string } = $props();
	const snapshot = $derived(workbench.view);
	const result = $derived(neighborhood(snapshot, traceId));
	const anchor = $derived(snapshot.traces.find((trace) => trace.id === traceId));
	const scopeOf = (id: string) => snapshot.scopes.find((scope) => scope.id === id);
	const scopeName = (id: string): string => scopeOf(id)?.name ?? id;
	/**
	 * What the text chips say: a distance reads with its side of the anchor; a shared Scope is
	 * told by the Scope chips themselves (they come first); a shared source only when it tells
	 * something — every record of the user's own space shares that one.
	 */
	const reasonsOf = (item: Neighbor) =>
		item.reasons.filter(
			(reason) =>
				reason.kind !== 'sharedScope' &&
				(reason.kind !== 'sharedSource' || anchor?.origin.kind !== 'canonical')
		);
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
			{@attach lensSource(workbench.hover, { kind: 'trace', traceId: item.traceId })}
		>
			<span class="font-mono text-xs text-muted"
				>{item.time ? formatDay(item.time.start) : t('neighborhood.undated')}</span
			>
			<span>{item.label}</span>
			<span class="flex flex-wrap gap-1">
				{#each reasonsOf(item) as reason (reasonKey(reason))}
					<span class={CHIP_CLASS}>{reasonLabel(reason, scopeName, isAfter(item))}</span>
				{/each}
				<!-- Every Scope the neighbour belongs to, as the Scope's own tinted chip (pack 3, P3), the ones
				     shared with the anchor first — so it is plain where each neighbour comes from now that the
				     list spans every Scope (owner, 2026-09-20). A record without Scopes shows no chip. -->
				{#each item.scopeIds as id (id)}
					{@const scope = scopeOf(id)}
					<ScopeChip
						{id}
						name={scope?.name ?? id}
						colorHue={scope?.colorHue ?? null}
						colorChroma={scope?.colorChroma ?? null}
						colorDepth={scope?.colorDepth ?? null}
						testId="neighbor-scope"
					/>
				{/each}
			</span>
		</button>
	</li>
{/snippet}

<!-- A one-off, explainable list around the anchor across every Scope; a click re-anchors (DESIGN.md §8, DP14). -->
<section class="flex flex-col gap-2" data-testid="context-neighborhood">
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
