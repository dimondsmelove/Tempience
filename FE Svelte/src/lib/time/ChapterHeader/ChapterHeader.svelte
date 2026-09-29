<script lang="ts">
	import { ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import { freeMidnight, msToIso, stageStep } from '$lib/model/Chapters';
	import type { StagePick } from '$lib/model/Chapters';
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
	/** The stage row walks «Вся глава» and the stages of the driving chapter, never out of it. */
	const stageBefore = $derived(driver ? stageStep(driver.chapter, driver.stage, -1) : undefined);
	const stageAfter = $derived(driver ? stageStep(driver.chapter, driver.stage, 1) : undefined);
	const stageName = $derived(driver?.stage?.name ?? t('chapter.whole'));
	const nameOf = (pick: StagePick | undefined): string | undefined =>
		pick === 'whole'
			? t('chapter.whole')
			: (driver?.chapter.stages.find((stage) => stage.id === pick)?.name ?? undefined);
	const go = (chapterId: string): void => workbench.selectChapter(chapterId);
	const goStage = (pick: StagePick | undefined): void => {
		if (driver && pick) workbench.selectChapter(driver.chapter.id, pick);
	};
</script>

<!-- The band row's own header in the rail, two lines (owner 2026-09-29): the chapter that drives
     the rows with ‹ › to its neighbours and «сейчас» back to the current chapter; under it, when
     the chapter has stages, the stage in force with ‹ › through «Вся глава» and the stages. -->
{#if driver}
	<div
		class="head"
		style:--chapter={chapterColour(driver.chapter)}
		data-testid="chapter-row-header"
	>
		<div class="line">
			<Button
				size="sm"
				variant="quiet"
				icon
				class="shrink-0"
				aria-label={t('chapter.previous')}
				title={previous ? previous.name : undefined}
				disabled={!previous}
				data-testid="chapter-prev"
				onclick={() => previous && go(previous.id)}
				><ChevronLeftOutline class="h-3.5 w-3.5" /></Button
			>
			<button
				type="button"
				class="name"
				title={driver.chapter.name}
				aria-label={t('chapter.showOnRibbon', { name: driver.chapter.name })}
				data-testid="chapter-current"
				onclick={() => {
					// The focus: the chapter chosen and the ribbon fitted to it.
					workbench.selectChapter(driver.chapter.id, null, true);
					onopen();
				}}
			>
				<span class="chapter" data-testid="chapter-current-name">{driver.chapter.name}</span>
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
		{#if driver.chapter.stages.length}
			<div class="line">
				<Button
					size="sm"
					variant="quiet"
					icon
					class="shrink-0"
					aria-label={t('chapter.previousStage')}
					title={nameOf(stageBefore)}
					disabled={!stageBefore}
					data-testid="stage-prev"
					onclick={() => goStage(stageBefore)}><ChevronLeftOutline class="h-3.5 w-3.5" /></Button
				>
				<button
					type="button"
					class="name"
					title={stageName}
					aria-label={t('chapter.stageOnRibbon', { name: stageName })}
					data-testid="chapter-current-stage-button"
					onclick={() => {
						workbench.selectChapter(driver.chapter.id, driver.stage?.id ?? 'whole', true);
						onopen();
					}}
				>
					<span class="stage" data-testid="chapter-current-stage">{stageName}</span>
				</button>
				<Button
					size="sm"
					variant="quiet"
					icon
					class="shrink-0"
					aria-label={t('chapter.nextStage')}
					title={nameOf(stageAfter)}
					disabled={!stageAfter}
					data-testid="stage-next"
					onclick={() => goStage(stageAfter)}><ChevronRightOutline class="h-3.5 w-3.5" /></Button
				>
			</div>
		{/if}
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
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		width: 100%;
		min-width: 0;
		height: 100%;
		padding: 2px 4px 2px 6px;
		background: color-mix(in oklab, var(--chapter) 10%, transparent);
		box-shadow: inset 3px 0 0 var(--chapter);
		font-family: var(--cg-font-sans);
		font-size: 12px;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.head.empty {
		flex-direction: row;
		align-items: center;
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
	.stage {
		min-width: 0;
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
