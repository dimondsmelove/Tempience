<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import TimelineCanvas from '$lib/time/TimelineCanvas/TimelineCanvas.svelte';
	import { zoomInput } from '$lib/time/TimelineInput/zoomInput';
	import { followClock } from '$lib/time/TimelineInput/followClock';
	import type { TimelineSurfaceProps } from './types';
	let {
		workbench,
		viewport,
		minHeightPx,
		rowHeightPx,
		phone,
		scopeContent,
		onempty,
		onscrollrows,
		interaction,
		linksShown = true,
		// eslint-disable-next-line no-useless-assignment -- the owner reads it through `bind:element`
		element = $bindable(null)
	}: TimelineSurfaceProps = $props();
	const projection = $derived(workbench.projection);
</script>

<div
	class="relative col-start-2 row-start-2 cursor-grab touch-none select-none active:cursor-grabbing"
	aria-label={interaction ? t('surface.pickTime') : t('surface.hint')}
	{@attach (node) => {
		element = node;
		return () => {
			element = null;
		};
	}}
	{@attach (node) => (interaction ? undefined : zoomInput(viewport, onscrollrows)(node))}
	{@attach (node) => (interaction ? undefined : followClock(viewport)(node))}
>
	<div inert={Boolean(interaction)}>
		<TimelineCanvas
			{minHeightPx}
			rows={projection.rows}
			window={viewport.window}
			now={viewport.now}
			selectedTraceId={workbench.selection.traceId}
			links={linksShown ? projection.links : []}
			showScopeRange={workbench.filters.isShown('scopeRange')}
			{rowHeightPx}
			onselect={(traceId, source) => workbench.selectTrace(traceId, source)}
			onzoomto={(range, traceIds) => workbench.zoomToCluster(range, traceIds)}
			{onempty}
		/>
	</div>
	{#if interaction}{@render interaction.overlay()}{/if}
	{#if phone}<div inert={Boolean(interaction)}>{@render scopeContent(true)}</div>{/if}
	{#if !interaction && (workbench.status === 'loading' || workbench.status === 'error' || projection.rows.length === 0)}
		<p
			class="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-sm text-muted"
			role="status"
		>
			{#if workbench.status === 'loading'}{t('surface.loading')}
			{:else if workbench.status === 'error'}{t('surface.loadFailed', { message: workbench.error })}
			{:else if projection.parked.length}{t('surface.onlyParked')}
			{:else if workbench.filters.activeCount}{t('surface.filtered')}
			{:else}{t('surface.empty')}{/if}
		</p>
	{/if}
</div>
