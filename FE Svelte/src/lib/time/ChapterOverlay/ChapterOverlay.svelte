<script lang="ts">
	import type { Chapter } from '$lib/model/Chapters/types';
	import type { TimeWindow } from '$lib/state/Viewport/types';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import { chapterLines } from './lines';

	type Props = Readonly<{
		chapters: readonly Chapter[];
		window: TimeWindow;
		now: number;
		/** The rail's width: the overlay spans it and the lanes; time starts after it. */
		railPx: number;
	}>;
	let { chapters, window, now, railPx }: Props = $props();

	let width = $state(0);
	const lines = $derived(chapterLines(chapters, window, Math.max(width - railPx, 0), now));
</script>

<!-- Over the rail and the lanes: the chapters' boundaries through all rows (like the year lines,
     no coloured backgrounds — DESIGN §1, §6). No line between the lineup and the shadow (owner
     2026-09-28): the shadow's row says it on its own. -->
<div class="overlay" data-testid="chapter-overlay" bind:clientWidth={width}>
	{#each lines as line (line.key)}
		<span
			class="line"
			aria-hidden="true"
			data-future={line.future || undefined}
			data-start={line.start || undefined}
			style:left="{railPx + line.x}px"
			style:--chapter={chapterColour(line.chapter, 'var(--cg-border-strong)')}
		></span>
	{/each}
</div>

<style>
	.overlay {
		position: relative;
		grid-column: 1 / span 2;
		grid-row: 2;
		pointer-events: none;
		overflow: visible;
		z-index: 1;
	}
	.line {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 0;
		border-left: 1px solid color-mix(in oklab, var(--chapter) 70%, transparent);
		pointer-events: none;
	}
	.line[data-future] {
		border-left-style: dashed;
	}
	/* A chapter's start: a small cap in its colour at the top, so the line reads as that chapter's. */
	.line[data-start]::before {
		content: '';
		position: absolute;
		top: 0;
		left: -4px;
		border-left: 3.5px solid transparent;
		border-right: 3.5px solid transparent;
		border-top: 5px solid var(--chapter);
	}
</style>
