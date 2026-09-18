<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { onMount } from 'svelte';
	import { VirtualList } from 'flowbite-svelte';
	import LifeGridRowComponent from './LifeGridRow.svelte';
	import type { LifeGridCell, LifeGridRow as LifeGridRowData } from './life-grid';
	import type { LifeScale } from './navigation';

	type Props = {
		rows: LifeGridRowData[];
		scale: LifeScale;
		traceFilled: Set<string>;
		scopeFilled: Set<string>;
		scopeActive: boolean;
		onCellClick: (cell: LifeGridCell) => void;
	};

	let { rows, scale, traceFilled, scopeFilled, scopeActive, onCellClick }: Props = $props();

	let container: HTMLDivElement | undefined = $state();
	let listHeight = $state(480);

	const rowHeight = $derived(
		scale === 'decade' ? 40 : scale === 'year' ? 30 : scale === 'month' ? 28 : 22
	);

	const columnHint = $derived(
		scale === 'decade'
			? t('life.decades')
			: scale === 'year'
				? t('life.years')
				: scale === 'month'
					? t('life.months')
					: t('life.weeksIso')
	);

	onMount(() => {
		const resize = (): void => {
			if (container) listHeight = Math.max(320, container.clientHeight);
		};
		resize();
		window.addEventListener('resize', resize);
		return () => window.removeEventListener('resize', resize);
	});

	$effect(() => {
		if (container) listHeight = Math.max(320, container.clientHeight);
	});
</script>

<div class="flex min-h-0 flex-1 flex-col">
	<div class="mb-2 flex gap-3 px-1 text-xs text-muted">
		<div class="w-14 shrink-0 text-right">{t('life.period')}</div>
		<div class="flex-1">{columnHint}</div>
		{#if scale === 'week'}
			<div class="w-8 shrink-0 text-right">#</div>
		{/if}
	</div>
	<div bind:this={container} class="min-h-[320px] flex-1">
		{#if rows.length === 0}
			<p class="text-sm text-muted">{t('life.empty')}</p>
		{:else}
			<VirtualList
				items={rows}
				height={listHeight}
				minItemHeight={rowHeight}
				overscan={8}
				contained
				ariaLabel={t('life.title')}
			>
				{#snippet children(row)}
					<LifeGridRowComponent
						{row}
						{scale}
						{traceFilled}
						{scopeFilled}
						{scopeActive}
						{onCellClick}
					/>
				{/snippet}
			</VirtualList>
		{/if}
	</div>
</div>
