<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import { SUPPLEMENT_KEYS } from './supplement';

	let { draft, originalId }: { draft: TraceDraftState; originalId: string | null } = $props();
	/** The canonical state of a saved marker; a new supplement has none yet. */
	const state = $derived(draft.supplement);
	/** Every original this record names now: one when it is valid, several in a conflict. */
	const originals = $derived.by((): string[] => {
		if (!state) return originalId ? [originalId] : [];
		if (state.status === 'ambiguous') return [...state.originalIds];
		return 'originalId' in state ? [state.originalId] : [];
	});
	const nameOf = (id: string): string => {
		const row = draft.results.rowOf(id);
		if (!row) return t('supplement.originalUnavailable');
		const title = row.summary.title ?? t('trace.unnamed');
		return row.trace.isDeleted ? t('supplement.originalDeleted', { title }) : title;
	};
</script>

<!-- A supplement is an ordinary completed record with one original and no place of its own on
     the timeline (P4). What it is now is read from the record itself, so reopening it later
     shows the same rules as creating it; a conflicting state is named, never repaired here. -->
<div class="grid gap-1" data-testid="supplement-fields" data-status={state?.status ?? 'new'}>
	<p class="text-sm text-muted" data-testid="draft-preset">
		{#if originals.length}
			{t('draft.presetSupplement', { title: originals.map(nameOf).join(', ') })}
		{:else}
			{t('supplement.withoutOriginal')}
		{/if}
		· {t('draft.presetNoTime')}
	</p>
	{#if state && state.status !== 'valid'}
		<p class="text-xs text-[color:var(--cg-danger)]" role="alert" data-testid="supplement-state">
			{t(SUPPLEMENT_KEYS[state.status])}
		</p>
	{/if}
</div>
