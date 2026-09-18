<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { LIST_BUTTON_CLASS } from '$lib/context/constants';
	import {
		explorerNeighborhood,
		explorerNeighborhoodConnections
	} from '$lib/model/Neighborhood/anchors';
	import { entityLabel } from '$lib/context/labels';
	import type { EntityViewProps } from './types';
	let { workbench, entityId }: EntityViewProps = $props();
	const context = $derived(explorerNeighborhood(workbench.view, entityId));
	const connections = $derived(context ? explorerNeighborhoodConnections(context) : []);
</script>

{#if context}
	<section
		class="flex flex-col gap-3"
		data-testid="context-entity"
		data-entity-role={context.focus.role}
	>
		<span class="font-mono text-xs text-muted"
			>{context.focus.role === 'intersection' ? t('entity.link') : t('entity.period')}</span
		>
		<h2 class="text-lg leading-tight font-semibold" data-testid="selected-title">
			{entityLabel(context.focus)}
		</h2>
		{#if context.focus.role === 'intersection' && context.focus.record.context}
			<p class="text-sm whitespace-pre-wrap">{context.focus.record.context}</p>
		{:else if context.focus.role === 'period'}
			<p class="font-mono text-xs text-muted">
				{context.focus.record.time.start} — {context.focus.record.time.end}
			</p>
			{#if context.focus.record.note}<p class="text-sm whitespace-pre-wrap">
					{context.focus.record.note}
				</p>{/if}
		{/if}
		{#each connections as item (item.direction + ':' + item.connection.id)}
			<div class="flex flex-col gap-1">
				<span class="cg-label"
					>{item.direction === 'from-endpoint'
						? t('entity.from')
						: item.direction === 'to-endpoint'
							? t('entity.to')
							: t('entity.relatedTo')}</span
				>
				{#if item.neighbor && item.neighbor.role !== 'scopeSegment'}
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						data-testid="entity-endpoint"
						data-entity-role={item.neighbor.role}
						onclick={() => workbench.selectEntity(item.neighbor!)}
						>{entityLabel(item.neighbor)}</button
					>
				{:else}<p class="text-sm text-muted">
						{t('entity.unavailableId', { id: item.neighborId })}
					</p>{/if}
				{#if context.focus.role !== 'intersection' && item.connection.source === 'intersection'}
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						onclick={() => workbench.selectIntersection(item.connection.sourceRecordId)}
						>{t('entity.linkDetails')}</button
					>
				{/if}
			</div>
		{/each}
		<details class="text-xs text-muted">
			<summary>{t('entity.technical')}</summary>
			<pre class="overflow-auto">{JSON.stringify(context.focus.record, null, 2)}</pre>
		</details>
	</section>
{:else}<p class="text-sm text-muted">{t('entity.unavailable')}</p>{/if}
