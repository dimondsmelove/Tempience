<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { nowIn } from './strip';
	import type { StageStripProps } from './types';

	let {
		windows,
		inForceId,
		nowId,
		now,
		stripEnd,
		colour,
		spanOf,
		onchoose,
		compact = false,
		testIdPrefix = '',
		whole = true
	}: StageStripProps = $props();
</script>

<!-- The chooser (owner 2026-09-29): «Вся глава», then a segment per stage, all of one width
     whatever their time. The one in force reads its whole name, filled with the chapter's colour
     and ringed; the others share the rest behind an ellipsis. «сейчас» is the accent line inside
     its stage. -->
<div
	class={['strip', compact && 'compact']}
	role="group"
	aria-label={t('chapter.stagesStrip')}
	style:--chapter={colour}
	data-testid="{testIdPrefix}chapter-strip"
>
	{#if whole}
		<button
			type="button"
			class="segment whole"
			aria-pressed={inForceId === null}
			data-testid="{testIdPrefix}strip-whole"
			onclick={() => onchoose('whole')}>{t('chapter.whole')}</button
		>
	{/if}
	{#each windows as item (item.stage.id)}
		{@const at = nowIn(item, now, stripEnd)}
		<button
			type="button"
			class="segment"
			data-current={item.stage.id === nowId || undefined}
			aria-pressed={item.stage.id === inForceId}
			title="{item.stage.name} · {spanOf(item)}"
			data-testid="{testIdPrefix}strip-stage"
			onclick={() => onchoose(item.stage.id)}
			>{item.stage.name}{#if at !== null}<span
					class="strip-now"
					style:left="{at}%"
					title={t('chapter.now')}
					aria-hidden="true"
				></span>{/if}</button
		>
	{:else}<span class="strip-empty">{t('chapter.noStages')}</span>{/each}
</div>

<style>
	.strip {
		display: flex;
		height: 30px;
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
		overflow: hidden;
	}
	.strip.compact {
		height: 18px;
	}
	/* Every segment the same width: the time of a stage does not size it. */
	.segment {
		position: relative;
		flex: 1 1 0;
		/* A folded segment still shows its first letters and the ellipsis. */
		min-width: 1.75rem;
		padding: 0 8px;
		overflow: hidden;
		border: 0;
		border-left: 1px solid var(--cg-bg-surface);
		background: color-mix(in oklab, var(--chapter) 14%, transparent);
		color: var(--cg-text-primary);
		font-size: 12px;
		text-align: left;
		white-space: nowrap;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.compact .segment {
		padding: 0 6px;
		font-size: 11px;
	}
	.segment.whole {
		border-left: 0;
		background: transparent;
	}
	.segment:hover,
	.segment[data-current] {
		color: var(--cg-text-primary);
	}
	/* The chosen segment: filled with the chapter's colour, bold — no ring. */
	.segment[aria-pressed='true'] {
		/* Its share or its whole name, whichever is wider: choosing never narrows a segment. */
		min-width: max-content;
		background: color-mix(in oklab, var(--chapter) 55%, transparent);
		color: var(--cg-text-primary);
		font-weight: 600;
	}
	.segment:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: -2px;
	}
	.strip-now {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background: var(--cg-accent);
		pointer-events: none;
	}
	.strip-empty {
		display: flex;
		flex: 1;
		align-items: center;
		padding: 0 8px;
		color: var(--cg-text-muted);
		font-size: 12px;
	}
</style>
