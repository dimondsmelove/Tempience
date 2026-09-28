<script lang="ts">
	import { untrack } from 'svelte';
	import { endOf, ms, msToIso, stageAt, stageBounds } from '$lib/model/Chapters';
	import type { Chapter, Lineup, Stage } from '$lib/model/Chapters/types';
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import EditorShell from '$lib/context/EditorShell/EditorShell.svelte';
	import LineupFields from '$lib/context/LineupFields/LineupFields.svelte';
	import TimeSpanField from '$lib/context/TimeSpanField/TimeSpanField.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { stageProblem } from './validation';

	type Props = Readonly<{
		workbench: WorkbenchState;
		chapter: Chapter;
		/** The stage being edited; absent for a new one. */
		stage?: Stage | null;
	}>;
	let { workbench, chapter, stage = null }: Props = $props();

	const store = $derived(workbench.chapters);
	const now = untrack(() => workbench.chapters.now);
	const zone = untrack(() => workbench.chapters.timeZone);
	/** A new stage starts now inside a running chapter, at the chapter's start otherwise. */
	const proposed = (): number => {
		const start = ms(chapter.start);
		const end = endOf(chapter);
		if (!chapter.stages.length) return start;
		return now > start && (end === null || now < end) ? now : start;
	};
	let name = $state(untrack(() => stage?.name ?? ''));
	let note = $state(untrack(() => stage?.note ?? ''));
	/** «Свой состав»: the stage's own lineup, prefilled from the chapter's; off — «как у главы». */
	let own = $state(untrack(() => Boolean(stage?.lineup)));
	let lineup = $state.raw<Lineup>(untrack(() => stage?.lineup ?? chapter.lineup));
	/** The stage's start as the TimeInput component sets it; its end is the next stage's start. */
	let startMs = $state(untrack(() => (stage ? ms(stage.start) : proposed())));
	/** An edited stage stays between its neighbours; the first one, starting with the chapter, stays put. */
	const bounds = $derived(stage ? stageBounds(chapter, stage.id) : null);
	const ending = $derived(!stage && startMs !== null ? stageAt(chapter, startMs) : null);
	const problem = $derived(stageProblem(chapter, stage?.id ?? null, name, startMs));
	let saving = $state(false);
	let failure = $state.raw<unknown>(null);

	/** «Удалить этап» waits for a yes; the stage before runs on over its time, records stay. */
	let confirming = $state(false);
	const remove = async (): Promise<void> => {
		if (!stage || saving) return;
		saving = true;
		failure = null;
		try {
			await store.removeStage(chapter, stage.id);
			workbench.selectChapter(chapter.id);
		} catch (cause: unknown) {
			failure = cause;
		} finally {
			saving = false;
		}
	};

	const save = async (): Promise<void> => {
		if (problem || startMs === null || saving) return;
		saving = true;
		failure = null;
		try {
			const id = await store.saveStage(chapter, stage?.id ?? null, {
				name: name.trim(),
				note: note.trim(),
				start: msToIso(startMs, zone),
				lineup: own ? lineup : null
			});
			workbench.selectChapter(chapter.id, id);
		} catch (cause: unknown) {
			failure = cause;
		} finally {
			saving = false;
		}
	};
</script>

<EditorShell
	heading={stage ? t('chapter.stageEdit') : t('chapter.stageNew')}
	testId="stage-form"
	busy={saving}
>
	<label class="grid gap-1 text-sm"
		>{t('chapter.name')}<input
			class="cg-control cg-field"
			data-testid="stage-name"
			placeholder={t('chapter.stageNamePlaceholder')}
			bind:value={name}
		/></label
	>
	<label class="grid gap-1 text-sm"
		>{t('chapter.note')}<textarea class="cg-control cg-field" bind:value={note}></textarea></label
	>
	<div class="grid gap-1">
		<TimeSpanField
			label={t('chapter.startLabel')}
			span={{ start: startMs, end: null }}
			disabled={bounds?.locked}
			testId="stage-time"
			onchange={(next) => (startMs = next.start)}
		/>
		{#if bounds?.locked}<span class="text-xs text-muted">{t('chapter.stageLocked')}</span>{/if}
	</div>
	<div class="grid gap-2 text-sm">
		<div class="flex items-center gap-2" role="group" aria-label={t('chapter.stageLineup')}>
			<span>{t('chapter.lineup')}</span>
			<Button
				size="sm"
				pressed={!own}
				data-testid="stage-lineup-chapter"
				onclick={() => (own = false)}>{t('chapter.asChapter')}</Button
			>
			<Button size="sm" pressed={own} data-testid="stage-lineup-own" onclick={() => (own = true)}
				>{t('chapter.ownLineup')}</Button
			>
		</div>
		{#if own}
			<LineupFields
				{lineup}
				view={workbench.view}
				testId="stage-lineup"
				onchange={(next) => (lineup = next)}
			/>
		{/if}
	</div>
	{#if ending && ms(ending.start) < startMs}
		<p class="text-sm text-muted">{t('chapter.stageEnds', { name: ending.name })}</p>
	{/if}
	{#snippet alerts()}
		{#if problem && name.trim()}<p role="alert" class="text-sm">{t(problem)}</p>
		{:else if failure !== null}<p role="alert" class="text-sm">{errorText(failure)}</p>{/if}
		{#if confirming}
			<div
				class="flex flex-wrap items-center gap-2 text-sm"
				role="alert"
				data-testid="stage-delete-confirm"
			>
				<span class="grow">{t('chapter.stageDeleteConfirm')}</span>
				<Button
					size="sm"
					variant="primary"
					data-testid="stage-delete-yes"
					onclick={() => void remove()}>{t('chapter.stageDeleteYes')}</Button
				>
				<Button size="sm" onclick={() => (confirming = false)}>{t('common.cancel')}</Button>
			</div>
		{/if}
	{/snippet}
	{#snippet actions()}
		<Button
			variant="primary"
			disabled={problem !== null || saving}
			data-testid="stage-save"
			onclick={() => void save()}>{stage ? t('chapter.stageSave') : t('chapter.stageStart')}</Button
		>
		<Button onclick={() => store.closeForm()}>{t('common.cancel')}</Button>
		{#if stage}<Button
				variant="quiet"
				class="ml-auto"
				data-testid="stage-delete"
				onclick={() => (confirming = true)}>{t('chapter.stageDelete')}</Button
			>{/if}
	{/snippet}
</EditorShell>
