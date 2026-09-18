<script lang="ts">
	import { conciseValues, type TraceSummary } from '$lib/model/TraceForm/summary';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { SUMMARY_DIAGNOSTIC_KEYS } from './constants';

	let { summary, limit = 2 }: { summary: TraceSummary; limit?: number } = $props();
	const values = $derived(conciseValues(summary, limit));
</script>

<!-- A typed record's own values (P1), apart from its Kind and its date; a Kind or a value that
     cannot be read says so here while the stored record stays exactly as it is. -->
{#if values.length}
	<span class="text-xs text-muted" data-testid="trace-values">
		{values.map((value) => `${value.label}: ${value.value}`).join(' · ')}
	</span>
{/if}
{#if summary.diagnostic}
	<span class="text-xs text-[color:var(--cg-danger)]" data-testid="trace-diagnostic">
		{t(SUMMARY_DIAGNOSTIC_KEYS[summary.diagnostic])}
	</span>
{/if}
