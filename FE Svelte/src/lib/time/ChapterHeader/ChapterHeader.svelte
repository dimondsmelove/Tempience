<script lang="ts">
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import { freeMidnight, msToIso } from '$lib/model/Chapters';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import Button from '$lib/ui/Button/Button.svelte';

	let { workbench, onopen }: { workbench: WorkbenchState; onopen: () => void } = $props();
	const store = $derived(workbench.chapters);
	/** Exactly what drives the rows: the chapter, and the stage in force — none for the whole chapter. */
	const driver = $derived(store.driver);
	const chapters = $derived(store.list);
	const index = $derived(driver ? chapters.findIndex((item) => item.id === driver.chapter.id) : -1);
	const previous = $derived(index > 0 ? chapters[index - 1] : null);
	const next = $derived(index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null);
	const current = $derived(store.current);
	const title = $derived(
		driver ? [driver.chapter.name, driver.stage?.name].filter(Boolean).join(' · ') : ''
	);
	const go = (chapterId: string): void => workbench.selectChapter(chapterId);
</script>

<!-- The band row's own header in the rail: the chapter that drives the rows and the stage in
     force, ‹ › to its neighbours, «сейчас» back to the current chapter. -->
{#if driver}
	<div
		class="head"
		style:--chapter={chapterColour(driver.chapter)}
		data-testid="chapter-row-header"
	>
		<Button
			size="sm"
			variant="quiet"
			icon
			class="shrink-0"
			aria-label={t('chapter.previous')}
			title={previous ? previous.name : undefined}
			disabled={!previous}
			data-testid="chapter-prev"
			onclick={() => previous && go(previous.id)}><ChevronLeftOutline class="h-3.5 w-3.5" /></Button
		>
		<button
			type="button"
			class="name"
			{title}
			aria-label={t('chapter.showOnRibbon', { name: driver.chapter.name })}
			data-testid="chapter-current"
			onclick={() => {
				// The focus: the chapter chosen and the ribbon fitted to it.
				workbench.selectChapter(driver.chapter.id, null, true);
				onopen();
			}}
		>
			<span class="chapter" data-testid="chapter-current-name">{driver.chapter.name}</span>
			{#if driver.stage}<span class="sep" aria-hidden="true"></span><span
					class="stage"
					data-testid="chapter-current-stage">{driver.stage.name}</span
				>{/if}
		</button>
		{#if current && current.id !== driver.chapter.id}
			<button
				type="button"
				class="now"
				title={t('chapter.toCurrent', { name: current.name })}
				data-testid="chapter-now"
				onclick={() => go(current.id)}>{t('chapter.now')}</button
			>
		{/if}
		<Button
			size="sm"
			variant="quiet"
			icon
			class="shrink-0"
			aria-label={t('chapter.next')}
			title={next ? next.name : undefined}
			disabled={!next}
			data-testid="chapter-next-step"
			onclick={() => next && go(next.id)}><ChevronRightOutline class="h-3.5 w-3.5" /></Button
		>
	</div>
{:else if chapters.length}
	<div class="head empty">
		<button
			type="button"
			class="name muted"
			data-testid="chapter-current"
			onclick={() => {
				store.edit({
					mode: 'new',
					start: msToIso(freeMidnight(chapters, store.now, store.timeZone), store.timeZone),
					fromChapterId: chapters.at(-1)?.id ?? null
				});
				onopen();
			}}>{t('chapter.start')}</button
		>
	</div>
{/if}

<style>
	/* The band row's header: its tint and a 3 px bar in the chapter's colour, like the band's
	   segment for the chapter in force; the row's height and borders come from the rail. */
	.head {
		display: flex;
		align-items: center;
		gap: 2px;
		width: 100%;
		min-width: 0;
		height: 100%;
		padding: 0 4px 0 6px;
		background: color-mix(in oklab, var(--chapter) 10%, transparent);
		box-shadow: inset 3px 0 0 var(--chapter);
		font-family: var(--cg-font-sans);
		font-size: 12px;
	}
	.head.empty {
		background: transparent;
		box-shadow: none;
	}
	.name {
		display: flex;
		flex: 1;
		min-width: 0;
		align-items: center;
		gap: 6px;
		height: 26px;
		padding: 0 6px;
		border: 0;
		border-radius: var(--cg-radius-control);
		background: transparent;
		color: var(--cg-text-primary);
		text-align: left;
		white-space: nowrap;
		cursor: pointer;
	}
	.name:hover,
	.now:hover {
		background: color-mix(in oklab, var(--chapter, var(--cg-text-muted)) 16%, transparent);
	}
	.name:focus-visible,
	.now:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: -2px;
	}
	.name.muted {
		color: var(--cg-text-muted);
		font-weight: 400;
	}
	.chapter {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 600;
	}
	.sep {
		flex: none;
		width: 1px;
		height: 12px;
		background: var(--cg-border-strong);
	}
	.stage {
		flex: none;
		max-width: 45%;
		overflow: hidden;
		text-overflow: ellipsis;
		color: var(--cg-text-muted);
	}
	.now {
		flex: none;
		height: 22px;
		padding: 0 6px;
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
		background: var(--cg-bg-surface);
		color: var(--cg-text-secondary);
		font-family: var(--cg-font-mono);
		font-size: 11px;
		cursor: pointer;
	}
</style>
