<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { formatDay } from '$lib/context/labels';
	import { laneIndexOf } from '$lib/model/Arrangement/Arrangement';
	import { UNSCOPED_ROW_KEY } from '$lib/model/Projection/constants';
	import { rowContext } from '$lib/model/RowContext/RowContext';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { lensSource } from '$lib/ui/LensSource';
	import type { RowViewProps } from './types';

	let { workbench, rowId }: RowViewProps = $props();
	/** The merged row as the ribbon shows it now; null once the lane is split or its members changed. */
	const row = $derived(
		workbench.projection.rows.find((item) => item.kind === 'merged' && item.id === rowId) ?? null
	);
	const context = $derived(row ? rowContext(row, workbench.view, t(UNSCOPED_ROW_KEY)) : null);
	/** The lane behind the row, for «Разделить» and the fold: found by the first member shown. */
	const laneIndex = $derived(
		context ? laneIndexOf(workbench.arrangement.lanes, context.members[0].id) : -1
	);
	/** «×» of the rail: the row is gone with the split, so the Context rests; the history keeps the entry. */
	const split = (): void => {
		if (laneIndex < 0) return;
		workbench.arrangement.split(laneIndex);
		workbench.rest();
	};
</script>

<!-- The Context of a merged row (loop 008, C5): the row's name under the eyebrow «Строка», the
     rail's «n · Σ m», the fold and the split as buttons, the members as chips — each a way to
     its Scope and a source of the lens — and the row's records once each, by time, as the
     period lists its own. -->
{#if context && row}
	<section class="flex flex-col gap-3" data-testid="context-row">
		<span class="font-mono text-xs text-muted">{t('row.eyebrow')}</span>
		<h2 class="min-w-0 text-lg leading-snug font-semibold break-words" data-testid="selected-title">
			{context.name}
		</h2>
		<p
			class="font-mono text-xs text-muted"
			data-testid="row-counts"
			title={t('rail.mergedCounts', {
				direct: context.directCount,
				subtree: context.subtreeCount
			})}
		>
			{context.directCount} · Σ {context.subtreeCount}
		</p>
		<div class="flex flex-wrap items-center gap-1" role="group" aria-label={t('row.actions')}>
			<Button
				size="sm"
				aria-expanded={context.expanded}
				aria-label={context.expanded
					? t('rail.foldRow', { name: context.name })
					: t('rail.unfoldRow', { name: context.name })}
				data-testid="row-toggle"
				onclick={() => {
					if (laneIndex >= 0) workbench.arrangement.toggleExpanded(laneIndex);
				}}>{context.expanded ? t('row.fold') : t('row.unfold')}</Button
			>
			<Button
				size="sm"
				variant="quiet"
				aria-label={t('rail.splitRow', { name: context.name })}
				data-testid="row-split"
				onclick={split}>{t('rail.split')}</Button
			>
		</div>
		<div class="flex flex-col gap-1">
			<h3 class="cg-label">{t('row.members')}</h3>
			<ul class="flex flex-wrap gap-1" aria-label={t('row.members')}>
				{#each context.members as member (member.id)}
					<li class="max-w-full min-w-0">
						<ScopeChip
							id={member.id}
							name={member.name}
							colorHue={member.colorHue}
							colorChroma={member.colorChroma}
							colorDepth={member.colorDepth}
							lens={member.lens}
							testId="row-member"
							onopen={(id) => workbench.selectScope(id, 'context')}
						/>
					</li>
				{/each}
			</ul>
		</div>
		<div class="flex flex-col gap-1">
			<h3 class="cg-label">{t('row.list')}</h3>
			{#if context.records.length}
				<ul class="flex flex-col gap-1">
					{#each context.records as item (item.traceId)}
						<li>
							<button
								type="button"
								class={LIST_BUTTON_CLASS}
								data-testid="row-record"
								data-trace-id={item.traceId}
								onclick={() => workbench.selectTrace(item.traceId, 'context')}
								{@attach lensSource(workbench.hover, { kind: 'trace', traceId: item.traceId })}
							>
								<span class="font-mono text-xs text-muted">{formatDay(item.start)}</span>
								<span>{item.label}</span>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-muted">{t('row.empty')}</p>
			{/if}
		</div>
	</section>
{:else}
	<!-- Chosen, but not on the ribbon now: the lane was split, or its members changed (C5). -->
	<section class="flex flex-col gap-3" data-testid="context-row-gone">
		<span class="font-mono text-xs text-muted">{t('row.eyebrow')}</span>
		<p class="text-sm text-muted">{t('row.gone')}</p>
	</section>
{/if}
