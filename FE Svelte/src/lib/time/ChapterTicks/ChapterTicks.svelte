<script lang="ts">
	import { HISTORY_TICKS } from '$lib/model/Chapters';
	import type { HistoryTick } from '$lib/model/Chapters/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { chapterColour } from '$lib/theme/chapter-colour';

	let { ticks }: { ticks: readonly HistoryTick[] } = $props();
	const title = $derived(ticks.map((tick) => tick.chapter.name).join(' · '));
</script>

<!-- A Scope's chapter history at its rail row's left edge: a tick in the colour of each chapter
     that had it in front, in time; the driving chapter's last and strongest. The slot keeps its
     width with no ticks, so every name in the rail starts at the same place. -->
<span
	class="ticks"
	style:width="{HISTORY_TICKS * 4}px"
	title={title || undefined}
	aria-label={title ? t('chapter.ticks', { names: title }) : undefined}
	role={title ? 'img' : undefined}
	data-testid="chapter-history"
	data-count={ticks.length}
>
	{#each ticks as tick (tick.chapter.id)}
		<span
			class="tick"
			data-driving={tick.driving || undefined}
			style:--chapter={chapterColour(tick.chapter)}
		></span>
	{/each}
</span>

<style>
	.ticks {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: 2px;
		height: 16px;
	}
	.tick {
		width: 2px;
		height: 10px;
		border-radius: 1px;
		background: var(--chapter);
		opacity: 0.45;
	}
	.tick[data-driving] {
		height: 16px;
		opacity: 1;
	}
</style>
