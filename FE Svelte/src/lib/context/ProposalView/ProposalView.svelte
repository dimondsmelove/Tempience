<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { CHIP_CLASS, TOGGLE_CLASS } from '$lib/context/constants';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { DECISIONS, GATE_KEYS } from './constants';

	let { workbench, traceId }: { workbench: WorkbenchState; traceId: string } = $props();
	const item = $derived(workbench.proposalItems.find((entry) => entry.traceId === traceId) ?? null);
	const trace = $derived(workbench.view.traces.find((entry) => entry.id === traceId) ?? null);
	const counts = $derived(workbench.proposalCounts);
</script>

<!-- A manifest candidate before Apply (DP15): the decision is a chip, the write happens only on «Применить». -->
{#if item && trace}
	<section class="flex flex-col gap-3" data-testid="context-proposal">
		<div class="flex flex-wrap gap-1">
			<span
				class={CHIP_CLASS}
				style:border-color="var(--cg-accent-secondary)"
				style:background-color="var(--cg-accent-secondary)"
				style:color="var(--cg-text-on-secondary)">{t('proposal.chip')}</span
			>
			<span class={CHIP_CLASS}>{t(GATE_KEYS[item.gate])}</span>
			{#if item.claimRefs.length}<span class={CHIP_CLASS}>{item.claimRefs.length} claim</span>{/if}
		</div>
		<h2 class="text-lg leading-tight font-semibold" data-testid="selected-title">{item.content}</h2>
		<p class="font-mono text-sm text-muted">{traceTimeLabel(trace, locale.current)}</p>
		{#if item.scopeNames.length}
			<p class="text-sm"><span class="text-muted">Scope:</span> {item.scopeNames.join(', ')}</p>
		{/if}
		{#if item.reason}<p class="text-sm text-muted">{item.reason}</p>{/if}
		<div role="group" aria-label={t('proposal.decision')} class="flex flex-wrap gap-1">
			{#each DECISIONS as [decision, label] (decision)}
				<button
					type="button"
					class={TOGGLE_CLASS}
					aria-pressed={item.decision === decision}
					data-testid={`decide-${decision}`}
					onclick={() => workbench.decideProposals([item.candidateId], decision)}>{t(label)}</button
				>
			{/each}
		</div>
		<label class="flex flex-col gap-1 text-sm">
			<span class="cg-label">{t('proposal.note')}</span>
			<textarea
				class="cg-field min-h-16 w-full text-sm"
				value={item.note}
				onchange={(event) =>
					workbench.decideProposals([item.candidateId], item.decision, event.currentTarget.value)}
			></textarea>
		</label>
		<p class="text-xs text-muted">
			{t('proposal.counts', {
				accepted: counts.accepted,
				deferred: counts.deferred,
				pending: counts.pending
			})}
		</p>
	</section>
{/if}
