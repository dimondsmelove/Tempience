<script lang="ts">
	import type { Chapter, Level } from '$lib/model/Chapters/types';
	import type { ProjectedRow } from '$lib/model/Projection/types';
	import type { TimeWindow } from '$lib/state/Viewport/types';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import { chapterLines, focusEnd, frontEnd } from './lines';

	type Props = Readonly<{
		chapters: readonly Chapter[];
		window: TimeWindow;
		now: number;
		rows: readonly ProjectedRow[];
		rowHeightPx: number;
		/** Rows standing for the driving lineup; null while no chapter orders the rows. */
		front: ReadonlySet<string> | null;
		/** Each front row's level. */
		levels: ReadonlyMap<string, Level> | null;
		/** The driving chapter's colour: the boundary between the front and the folded rest. */
		colour: string;
		/** The rail's width: the overlay spans it and the lanes; time starts after it. */
		railPx: number;
	}>;
	let { chapters, window, now, rows, rowHeightPx, front, levels, colour, railPx }: Props = $props();

	let width = $state(0);
	const lines = $derived(chapterLines(chapters, window, Math.max(width - railPx, 0), now));
	const boundary = $derived(frontEnd(rows, front));
	const focus = $derived(focusEnd(rows, levels));
</script>

<!-- Over the rail and the lanes: the chapters' boundaries through all rows (like the year lines,
     no coloured backgrounds — DESIGN §1, §6), and one thin line in the chapter's colour where the
     front ends and the folded rest begins — no words. -->
<div class="overlay" data-testid="chapter-overlay" bind:clientWidth={width}>
	{#if focus > 0}
		<div
			class="focus-end"
			aria-hidden="true"
			style:top="{focus * rowHeightPx}px"
			style:--chapter={colour}
			data-testid="chapter-focus-end"
		></div>
	{/if}
	{#if boundary > 0}
		<div
			class="boundary"
			aria-hidden="true"
			style:top="{boundary * rowHeightPx}px"
			style:--chapter={colour}
			data-testid="chapter-boundary"
		></div>
	{/if}
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
	.boundary {
		position: absolute;
		left: 0;
		right: 0;
		height: 0;
		border-top: 2px solid var(--chapter);
		margin-top: -1px;
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
	/* The focus's end is a line the owner drew, not a border of the data: dashed, 6 on 4. */
	.focus-end {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background: repeating-linear-gradient(
			to right,
			color-mix(in oklab, var(--chapter) 90%, transparent) 0 6px,
			transparent 6px 10px
		);
	}
</style>
