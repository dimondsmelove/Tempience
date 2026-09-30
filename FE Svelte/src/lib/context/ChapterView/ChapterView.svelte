<script lang="ts">
	import {
		ArrowRightOutline,
		CirclePlusOutline,
		CloseCircleOutline,
		PenOutline,
		PlusOutline,
		TrashBinOutline
	} from 'flowbite-svelte-icons';
	import ContextActions from '$lib/context/ContextActions/ContextActions.svelte';
	import ContextNote from '$lib/context/ContextNote/ContextNote.svelte';
	import ContextSection from '$lib/context/ContextSection/ContextSection.svelte';
	import { FoldedSections } from '$lib/context/ContextSection/FoldedSections.svelte';
	import ContextTitle from '$lib/context/ContextTitle/ContextTitle.svelte';
	import ColorBlossomPicker from '$lib/context/ScopeEditor/ColorBlossomPicker/ColorBlossomPicker.svelte';
	import StageStrip from '$lib/context/StageStrip/StageStrip.svelte';
	import {
		CHAPTER_STATUS_KEYS,
		countsUnder,
		driverOf,
		endOf,
		formatMoment,
		formatSpan,
		freeMidnight,
		idsAt,
		ms,
		msToIso,
		recordsIn,
		stageAt,
		stageInForce,
		stageWindows,
		statusAt,
		stripEndOf,
		withDescendants
	} from '$lib/model/Chapters';
	import type { Chapter, StagePick, StageWindow } from '$lib/model/Chapters/types';
	import { errorText } from '$lib/state/Locale/errors';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import type { ScopeColour } from '$lib/theme/scope-colour';
	import Button from '$lib/ui/Button/Button.svelte';
	import { DOT_HEADING_PX } from '$lib/ui/ScopeDot';
	import ChapterLineup from './ChapterLineup.svelte';
	import ChapterRecords from './ChapterRecords.svelte';
	import { CHAPTER_SECTIONS, CHAPTER_SECTIONS_STORAGE_KEY } from './constants';

	type Props = Readonly<{ workbench: WorkbenchState; chapter: Chapter; pick: StagePick }>;
	let { workbench, chapter, pick }: Props = $props();

	const store = $derived(workbench.chapters);
	const now = $derived(store.now);
	const zone = $derived(store.timeZone);
	const start = $derived(ms(chapter.start));
	const end = $derived(endOf(chapter));
	const status = $derived(statusAt(chapter, now));
	const colour = $derived(chapterColour(chapter));
	const windows = $derived(stageWindows(chapter));
	/** The stage in force: the one chosen, or the current one when nothing is; none for «Вся глава». */
	const inForce = $derived(stageInForce(chapter, pick, now));
	const focused = $derived(windows.find((item) => item.stage.id === inForce?.id) ?? null);
	/**
	 * What the Context shows (owner 2026-09-29): a stage chosen in the strip as itself — its
	 * name, dates, note and actions; the chapter opened, or «Вся глава», shows the chapter.
	 */
	const stage = $derived(
		pick !== null && pick !== 'whole'
			? (windows.find((item) => item.stage.id === pick) ?? null)
			: null
	);
	const nowId = $derived(stageAt(chapter, now)?.id ?? null);
	const stripEnd = $derived(stripEndOf(chapter, now));
	/** Who orders the rows for this chapter now: the chosen stage's lineup, the current stage's, or the chapter's. */
	const driver = $derived(driverOf(chapter, pick, now));
	/** The lineup's records in the stage in force or the whole chapter: listed, and counted per Scope. */
	const listed = $derived(
		recordsIn(
			workbench.view,
			withDescendants(idsAt(driver.lineup), workbench.view),
			focused?.start ?? start,
			(focused ? (focused.end ?? end) : end) ?? Infinity,
			workbench.projection.timeByTraceId
		)
	);
	const counts = $derived(countsUnder(listed, idsAt(driver.lineup), workbench.view));
	/** The chapter right after this one, when it already exists. */
	const following = $derived(
		end === null ? null : (store.list.find((item) => ms(item.start) === end) ?? null)
	);
	const spanOf = (item: StageWindow): string =>
		formatSpan(item.start, item.end, zone, locale.current, now);
	const choose = (stage: StagePick): void => workbench.selectChapter(chapter.id, stage);

	const folds = new FoldedSections(
		CHAPTER_SECTIONS.map((entry) => entry.id),
		CHAPTER_SECTIONS_STORAGE_KEY
	);
	const noteText = $derived(stage ? stage.stage.note : chapter.note);
	const shown = $derived(
		CHAPTER_SECTIONS.filter((entry) => entry.id !== 'note' || Boolean(noteText))
	);
	const titleOf = (id: string, label: string): string =>
		id === 'stages'
			? `${label} · ${windows.length}`
			: id === 'lineup' && driver.stage?.lineup
				? `${label} · ${t('chapter.lineupOfStage', { name: driver.stage.name })}`
				: id === 'records'
					? `${label} · ${listed.length}`
					: label;

	let closing = $state(false);
	/** The stage whose removal waits for a yes. */
	let removing = $state<string | null>(null);
	const removeStage = async (stageId: string): Promise<void> => {
		await store.removeStage(chapter, stageId);
		removing = null;
		choose('whole');
	};
	let failure = $state.raw<unknown>(null);
	const close = async (): Promise<void> => {
		failure = null;
		try {
			await store.close(chapter.id, msToIso(now, zone));
			closing = false;
		} catch (cause: unknown) {
			failure = cause;
		}
	};
	/** The dot opens the flower and saves the pick at once, as a Scope's dot does. */
	let colourFailed = $state(false);
	const pickColour = async (picked: ScopeColour | null): Promise<void> => {
		colourFailed = false;
		try {
			await store.recolour(chapter.id, picked);
		} catch {
			colourFailed = true;
		}
	};
</script>

{#snippet dot()}
	{#key chapter.id}
		<ColorBlossomPicker
			hue={chapter.colorHue}
			chroma={chapter.colorChroma}
			depth={chapter.colorDepth}
			label={t('chapter.colour')}
			variant="dot"
			size={DOT_HEADING_PX}
			testId="chapter-colour-dot"
			onpick={(picked) => void pickColour(picked)}
		/>
	{/key}
{/snippet}

{#snippet note()}
	<ContextNote text={noteText} textTestId={stage ? 'stage-note' : 'chapter-note'} />
{/snippet}

{#snippet stages()}
	<StageStrip
		{windows}
		inForceId={inForce?.id ?? null}
		{nowId}
		{now}
		{stripEnd}
		{colour}
		{spanOf}
		onchoose={choose}
	/>
{/snippet}

{#snippet lineup()}
	<ChapterLineup {workbench} lineup={driver.lineup} {counts} />
{/snippet}

{#snippet records()}
	<ChapterRecords {workbench} lineup={driver.lineup} records={listed} />
{/snippet}

<section class="flex flex-col gap-3" data-testid="chapter-view">
	{#if stage}
		<ContextTitle
			title={stage.stage.name}
			meta={t('chapter.stageMeta', { chapter: chapter.name, span: spanOf(stage) })}
		/>
	{:else}
		<ContextTitle
			title={chapter.name}
			meta={t('chapter.meta', {
				span: formatSpan(start, end, zone, locale.current, now),
				status: t(CHAPTER_STATUS_KEYS[status])
			})}
			{dot}
		/>
	{/if}
	{#if colourFailed}<p class="text-xs text-muted" role="alert">
			{t('chapter.recolourFailed')}
		</p>{/if}
	{#if stage}
		{@const stageId = stage.stage.id}
		<ContextActions label={t('chapter.actions')}>
			<Button
				size="sm"
				icon
				aria-label={t('chapter.stageEditNamed', { name: stage.stage.name })}
				title={t('chapter.stageEditNamed', { name: stage.stage.name })}
				data-testid="stage-edit"
				onclick={() => store.edit({ mode: 'stage', chapterId: chapter.id, stageId })}
				><PenOutline class="h-4 w-4" /></Button
			>
			<Button
				size="sm"
				icon
				aria-label={t('chapter.stageNew')}
				title={t('chapter.stageNew')}
				data-testid="chapter-stage-new"
				onclick={() => store.edit({ mode: 'stage', chapterId: chapter.id, stageId: null })}
				><PlusOutline class="h-4 w-4" /></Button
			>
			<Button
				size="sm"
				icon
				variant="quiet"
				aria-label={t('chapter.stageDeleteNamed', { name: stage.stage.name })}
				title={t('chapter.stageDeleteNamed', { name: stage.stage.name })}
				data-testid="stage-remove"
				onclick={() => (removing = stageId)}><TrashBinOutline class="h-4 w-4" /></Button
			>
		</ContextActions>
		{#if removing === stageId}
			<div class="grid gap-2 text-sm" role="alert" data-testid="stage-remove-confirm">
				<p>{t('chapter.stageDeleteConfirm')}</p>
				<div class="flex gap-2">
					<Button
						size="sm"
						variant="primary"
						data-testid="stage-remove-yes"
						onclick={() => void removeStage(stageId)}>{t('chapter.stageDeleteYes')}</Button
					>
					<Button size="sm" onclick={() => (removing = null)}>{t('common.cancel')}</Button>
				</div>
			</div>
		{/if}
	{:else}
		<ContextActions label={t('chapter.actions')}>
			<Button
				size="sm"
				icon
				aria-label={t('chapter.edit')}
				title={t('chapter.edit')}
				data-testid="chapter-edit"
				onclick={() => store.edit({ mode: 'edit', chapterId: chapter.id })}
				><PenOutline class="h-4 w-4" /></Button
			>
			<Button
				size="sm"
				icon
				aria-label={t('chapter.stageNew')}
				title={t('chapter.stageNew')}
				data-testid="chapter-stage-new"
				onclick={() => store.edit({ mode: 'stage', chapterId: chapter.id, stageId: null })}
				><PlusOutline class="h-4 w-4" /></Button
			>
			{#if following}
				<Button
					size="sm"
					icon
					aria-label={t('chapter.nextNamed', { name: following.name })}
					title={t('chapter.nextNamed', { name: following.name })}
					data-testid="chapter-next"
					onclick={() => workbench.selectChapter(following.id)}
					><ArrowRightOutline class="h-4 w-4" /></Button
				>
			{:else}
				<Button
					size="sm"
					icon
					aria-label={t('chapter.startNext')}
					title={t('chapter.startNext')}
					data-testid="chapter-next"
					onclick={() =>
						store.edit({
							mode: 'new',
							start: msToIso(freeMidnight(store.list, now, zone), zone),
							fromChapterId: chapter.id
						})}><CirclePlusOutline class="h-4 w-4" /></Button
				>
			{/if}
			{#if status === 'current'}
				<Button
					size="sm"
					icon
					variant="quiet"
					aria-label={t('chapter.close')}
					title={t('chapter.close')}
					data-testid="chapter-close"
					onclick={() => (closing = true)}><CloseCircleOutline class="h-4 w-4" /></Button
				>
			{/if}
		</ContextActions>
		{#if closing}
			<div class="grid gap-2 text-sm" role="alert">
				<p>
					{t('chapter.closeNow', { moment: formatMoment(now, zone, locale.current, now) })}
					{#if following}{t('chapter.closeGap', {
							name: following.name,
							moment: formatMoment(ms(following.start), zone, locale.current, now)
						})}{/if}
				</p>
				{#if failure !== null}<p class="text-xs">{errorText(failure)}</p>{/if}
				<div class="flex gap-2">
					<Button size="sm" variant="primary" onclick={() => void close()}
						>{t('chapter.close')}</Button
					>
					<Button size="sm" onclick={() => (closing = false)}>{t('common.cancel')}</Button>
				</div>
			</div>
		{/if}
	{/if}
	{#each shown as entry (entry.id)}
		<ContextSection
			id={entry.id}
			label={t(entry.label)}
			title={titleOf(entry.id, t(entry.label))}
			collapsed={folds.collapsed[entry.id]}
			ontoggle={() => folds.toggle(entry.id)}
		>
			{@render (entry.id === 'note'
				? note
				: entry.id === 'stages'
					? stages
					: entry.id === 'lineup'
						? lineup
						: records)()}
		</ContextSection>
	{/each}
</section>
