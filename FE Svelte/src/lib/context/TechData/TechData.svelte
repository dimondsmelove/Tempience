<script lang="ts">
	import { traceChips } from '$lib/context/labels';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';

	let { trace }: { trace: ExplorerTrace } = $props();
	/** What the overview line used to carry — placement, relation, precision, certainty — now here. */
	const rows = $derived([
		['placement', traceChips(trace).join(' · ')],
		['id', trace.id],
		['origin', `${trace.origin.kind} · ${trace.origin.sourceId}`],
		['timezone', trace.timezone],
		['kind', trace.kindId ?? '—'],
		['kindV', trace.kindVId ?? '—']
	]);
</script>

<!-- The record's technical facts: a section like the others, last in the Context (owner, 2026-09-15). -->
<dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs" data-testid="tech-data">
	{#each rows as [key, value] (key)}
		<dt class="text-muted">{key}</dt>
		<dd class="break-all">{value}</dd>
	{/each}
	{#if trace.data}
		<dt class="text-muted">data</dt>
		<dd class="break-all whitespace-pre-wrap">{JSON.stringify(trace.data, null, 1)}</dd>
	{/if}
</dl>
