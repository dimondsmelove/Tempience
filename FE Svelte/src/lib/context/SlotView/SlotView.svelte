<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { formatDay } from '$lib/context/labels';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';

	let { workbench }: { workbench: WorkbenchState } = $props();
	const slot = $derived(workbench.slot);
	const items = $derived(
		slot
			? slot.traceIds.flatMap((id) => {
					const trace = workbench.view.traces.find((item) => item.id === id);
					return trace ? [trace] : [];
				})
			: []
	);
</script>

<!-- Records the canvas could not tell apart at the limit; picking one keeps the list (DESIGN.md §5). -->
{#if slot}
	<section class="flex flex-col gap-1 border-t border-outline pt-2" data-testid="context-slot">
		<h3 class="cg-label">
			{t('slot.title', { day: formatDay(slot.range.start), count: items.length })}
		</h3>
		<ul class="flex flex-col gap-1">
			{#each items as trace (trace.id)}
				<li>
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						aria-current={trace.id === workbench.selection.traceId}
						onclick={() =>
							workbench.selection.select({ kind: 'trace', traceId: trace.id }, 'canvas')}
					>
						<span>{trace.content}</span>
						<span class="font-mono text-xs text-muted">{traceTimeLabel(trace, locale.current)}</span
						>
					</button>
				</li>
			{/each}
		</ul>
	</section>
{/if}
