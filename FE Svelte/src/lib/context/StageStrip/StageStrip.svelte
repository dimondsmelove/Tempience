<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { growOf, nowIn } from './strip';
	import type { StageStripProps } from './types';

	let { windows, inForceId, nowId, now, stripEnd, colour, spanOf, onchoose }: StageStripProps =
		$props();
</script>

<!-- The chooser, as the lab drew it (owner 2026-09-28): «Вся глава», then a segment per stage
     as wide as its time and never narrower than its name. The one in force is filled with the
     chapter's colour and ringed; «сейчас» is the accent line inside its stage. -->
<div
	class="strip"
	role="group"
	aria-label={t('chapter.stagesStrip')}
	style:--chapter={colour}
	data-testid="chapter-strip"
>
	<button
		type="button"
		class="segment whole"
		aria-pressed={inForceId === null}
		data-testid="strip-whole"
		onclick={() => onchoose('whole')}>{t('chapter.whole')}</button
	>
	{#each windows as item (item.stage.id)}
		{@const at = nowIn(item, now, stripEnd)}
		<button
			type="button"
			class="segment"
			data-current={item.stage.id === nowId || undefined}
			aria-pressed={item.stage.id === inForceId}
			title="{item.stage.name} · {spanOf(item)}"
			data-testid="strip-stage"
			style:flex-grow={growOf(item, stripEnd)}
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
	.segment {
		position: relative;
		flex-basis: 0;
		flex-shrink: 1;
		/* A stage never pushes the strip past the Context: its name gives way to an ellipsis. */
		min-width: 2.5rem;
		padding: 0 8px;
		overflow: hidden;
		border: 0;
		border-left: 1px solid var(--cg-bg-surface);
		background: color-mix(in oklab, var(--chapter) 14%, transparent);
		color: var(--cg-text-muted);
		font-size: 12px;
		text-align: left;
		white-space: nowrap;
		text-overflow: ellipsis;
		cursor: pointer;
	}
	.segment.whole {
		flex: none;
		border-left: 0;
		border-right: 1px solid var(--cg-border-default);
		background: transparent;
	}
	.segment:hover,
	.segment[data-current] {
		color: var(--cg-text-primary);
	}
	/* The chosen segment: filled with the chapter's colour, ringed, bold — clearly the one. */
	.segment[aria-pressed='true'] {
		/* The chosen stage always reads its whole name; the others give way around it. */
		min-width: fit-content;
		flex-shrink: 0;
		background: color-mix(in oklab, var(--chapter) 55%, transparent);
		box-shadow: inset 0 0 0 1.5px var(--cg-text-primary);
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
