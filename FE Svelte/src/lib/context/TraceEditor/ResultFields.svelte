<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ResultPicker from './ResultPicker.svelte';
	import ResultTarget from './ResultTarget.svelte';

	let { draft }: { draft: TraceDraftState } = $props();
	const role = $derived(draft.targetContext.role);
	let picking = $state(false);
</script>

<!-- «Результат для» of a fact, «Результаты» of a saved intention (TRACE_FORMS «входы»): several
     records, each with its own statement; nothing chosen means no assessment at all. -->
<div class="grid gap-2" data-testid="result-fields" data-role={role}>
	<span class="text-sm"
		>{t(role === 'intention' ? 'result.for' : 'result.results')}
		<span class="text-xs text-muted">· {t('draft.optional')}</span></span
	>
	{#if draft.results.targets.length}
		<ul class="grid gap-2" aria-label={t('result.chosen')}>
			{#each draft.results.targets as target (target.otherId)}
				<li><ResultTarget {draft} {target} /></li>
			{/each}
		</ul>
	{/if}
	{#if picking}
		<ResultPicker {draft} onclose={() => (picking = false)} />
	{:else}
		<Button
			size="sm"
			class="justify-self-start"
			data-testid="result-pick"
			onclick={() => (picking = true)}
			>{t(role === 'intention' ? 'result.pick' : 'result.pickFact')}</Button
		>
	{/if}
</div>
