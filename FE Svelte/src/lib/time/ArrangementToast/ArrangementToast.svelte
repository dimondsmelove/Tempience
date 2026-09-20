<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { laneName } from '$lib/model/Arrangement/Arrangement';
	import type { ArrangementToastProps } from './types';

	let { arrangement, scopesById }: ArrangementToastProps = $props();
	/** What was done, in the words of the moment: a merge names the row it made (Q1-A). */
	const label = $derived.by(() => {
		const pending = arrangement.pending;
		if (!pending) return '';
		if (pending.change === 'merge') {
			const lane = pending.laneIndex === null ? null : arrangement.lanes.lanes[pending.laneIndex];
			return t('arrangement.merged', { name: lane ? laneName(lane, scopesById) : '' });
		}
		if (pending.change === 'reorder') return t('arrangement.reordered');
		if (pending.change === 'split' || pending.change === 'splitAll') return t('arrangement.split');
		if (pending.change === 'unclaim') return t('arrangement.returned');
		if (pending.change === 'collapse') return t('arrangement.collapsed');
		if (pending.change === 'reset') return t('arrangement.reset');
		return t('arrangement.renamed');
	});
</script>

<!-- Q4-A: one level, six seconds, at the bottom of the Time surface; Ctrl+Z on the surface is the same undo.
     The «⋯» menu's changes (C3) come through here too: «Схлопнуто», «Разделено», «Сброшено». -->
{#if arrangement.pending}
	<div
		class="cg-popover absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 border border-outline bg-raised px-3 py-2 text-sm whitespace-nowrap text-ink shadow-md"
		role="status"
		data-testid="arrangement-toast"
	>
		<span>{label}</span>
		<Button size="sm" data-testid="arrangement-undo" onclick={() => arrangement.undo()}
			>{t('arrangement.undo')}</Button
		>
	</div>
{/if}
