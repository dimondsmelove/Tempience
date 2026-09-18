<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { LifeScale } from './navigation';
	import { cellHasFill, type LifeGridCell, type LifeGridRow } from './life-grid';

	type Props = {
		row: LifeGridRow;
		scale: LifeScale;
		traceFilled: Set<string>;
		scopeFilled: Set<string>;
		scopeActive: boolean;
		onCellClick: (cell: LifeGridCell) => void;
	};

	let { row, scale, traceFilled, scopeFilled, scopeActive, onCellClick }: Props = $props();

	const cellClass = (cell: LifeGridCell): string => {
		if (cell.empty) {
			return 'h-4 min-w-0 flex-1 rounded-sm bg-surface opacity-40';
		}

		const inScope = scopeActive && cellHasFill(cell, scopeFilled, scale);
		const hasTraces = cellHasFill(cell, traceFilled, scale);
		const height =
			scale === 'decade' ? 'h-8' : scale === 'year' ? 'h-5' : scale === 'month' ? 'h-5' : 'h-3';

		const parts = [
			height,
			'min-w-0 flex-1 rounded-sm border border-transparent transition-colors',
			scale === 'week' ? '' : 'hover:border-accent hover:brightness-110',
			inScope ? 'bg-warning' : '',
			!inScope && hasTraces ? 'bg-accent' : '',
			!inScope && !hasTraces && cell.isFuture ? 'bg-raised' : '',
			!inScope && !hasTraces && cell.isPast ? 'bg-outline' : '',
			!inScope && !hasTraces && cell.isCurrent ? 'bg-accent/20' : '',
			cell.isCurrent ? 'ring-1 ring-accent' : ''
		];
		return parts.filter(Boolean).join(' ');
	};

	const cellTitle = (cell: LifeGridCell): string => {
		if (cell.empty) return t('life.cellEmpty', { row: row.label, cell: cell.label });
		const parts = [cell.label];
		if (cell.weekStarts.length > 1)
			parts.push(t('life.cellWeeks', { count: cell.weekStarts.length }));
		if (scopeActive && cellHasFill(cell, scopeFilled, scale)) parts.push(t('life.cellScope'));
		if (cellHasFill(cell, traceFilled, scale)) parts.push(t('life.cellTraces'));
		if (cell.isCurrent) parts.push(t('life.now'));
		if (scale !== 'week') parts.push(t('life.zoomHint'));
		return parts.join(' · ');
	};
</script>

<div class="flex items-center gap-3 py-0.5">
	<div class="w-14 shrink-0 text-right text-xs tabular-nums text-muted">
		{row.label}
	</div>
	<div class="flex min-w-0 flex-1 gap-px">
		{#each row.cells as cell (cell.id)}
			{#if cell.empty}
				<div class={cellClass(cell)} title={cellTitle(cell)} aria-hidden="true"></div>
			{:else if scale === 'week'}
				<div class={cellClass(cell)} title={cellTitle(cell)}></div>
			{:else}
				<button
					type="button"
					class={cellClass(cell)}
					title={cellTitle(cell)}
					aria-label={t('life.periodCell', { cell: cell.label })}
					onclick={() => onCellClick(cell)}
				></button>
			{/if}
		{/each}
	</div>
	{#if scale === 'week'}
		<div class="w-8 shrink-0 text-right text-xs text-muted">{row.cells.length}</div>
	{/if}
</div>
