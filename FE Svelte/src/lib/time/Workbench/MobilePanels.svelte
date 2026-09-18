<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import BottomSheet from '$lib/ui/BottomSheet/BottomSheet.svelte';
	import Legend from '$lib/time/Legend/Legend.svelte';
	import Parked from '$lib/time/Parked/Parked.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { scenarioImportRepository } from '$lib/state/triplit';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import type { MobilePanelsProps } from './types';

	let {
		workbench,
		panel = $bindable(null),
		position = $bindable('half'),
		sheetHeight = $bindable(0),
		scopeContent,
		controls,
		contextContent,
		contextHost,
		oncontextclose
	}: MobilePanelsProps = $props();
	// The Context belongs to the workbench: closing it (guard, open form, panel) is its call.
	function close() {
		if (panel === 'context') oncontextclose();
		else panel = null;
	}
	const projection = $derived(workbench.projection);
	const selection = $derived(workbench.selection);
</script>

{@render controls(true)}
{#if panel}
	<BottomSheet
		bind:measuredHeight={sheetHeight}
		label={panel === 'context'
			? 'Context'
			: panel === 'rail'
				? 'Scope'
				: panel === 'filters'
					? t('toolbar.filters')
					: t('toolbar.parked')}
		{position}
		modal={panel !== 'context'}
		heading={panel !== 'context' && panel !== 'rail'}
		onposition={(next) => (position = next)}
		onclose={close}
	>
		{#if panel === 'context'}
			{#if contextContent}{@render contextContent(true)}{:else}
				<div class="contents" {@attach contextHost}></div>
			{/if}
		{:else if panel === 'rail'}
			{@render scopeContent(false)}
		{:else if panel === 'filters'}
			<div class="cg-panel flex flex-col gap-3">
				<Legend filters={workbench.filters} scopes={workbench.snapshot.scopes} />
				<Button
					disabled={workbench.filters.activeCount === 0}
					data-testid="filters-reset"
					onclick={() => workbench.filters.reset()}>{t('toolbar.resetAll')}</Button
				>
				{#if workbench.proposalCounts.pending}<span class="text-sm text-muted"
						>{t('toolbar.pendingColon', { count: workbench.proposalCounts.pending })}</span
					>{/if}
				{#if workbench.proposalCounts.accepted}<Button
						disabled={activeDataSpace.kind !== 'scenario'}
						data-testid="apply-proposals"
						onclick={() =>
							workbench.applyProposals(
								scenarioImportRepository,
								activeDataSpace,
								loadWorkbenchSnapshot,
								localStorage
							)}>{t('toolbar.apply', { count: workbench.proposalCounts.accepted })}</Button
					>{/if}
			</div>
		{:else}
			<Parked
				list
				traces={projection.parked}
				selectedTraceId={selection.traceId}
				railOpen={false}
				onselect={(traceId) => workbench.selectTrace(traceId, 'parked')}
			/>
		{/if}
	</BottomSheet>
{/if}
