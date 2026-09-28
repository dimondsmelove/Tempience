<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import ColorBlossomPicker from '$lib/context/ScopeEditor/ColorBlossomPicker/ColorBlossomPicker.svelte';
	import ColorHuePicker from '$lib/context/ScopeEditor/ColorHuePicker/ColorHuePicker.svelte';
	import EditorShell from '$lib/context/EditorShell/EditorShell.svelte';
	import LineupFields from '$lib/context/LineupFields/LineupFields.svelte';
	import {
		formatMoment,
		idsAt,
		freeHue,
		ms,
		msToIso,
		planInsert,
		sortChapters,
		statusAt
	} from '$lib/model/Chapters';
	import type { Chapter, Lineup } from '$lib/model/Chapters/types';
	import { errorText } from '$lib/state/Locale/errors';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import type { ScopeColour } from '$lib/theme/scope-colour';
	import Button from '$lib/ui/Button/Button.svelte';
	import TimeSpanField from '$lib/context/TimeSpanField/TimeSpanField.svelte';
	import type { TimeSpan } from '$lib/context/TimeSpanField/types';
	import { chapterProblem } from './validation';

	type Props = Readonly<{
		workbench: WorkbenchState;
		/** The chapter being edited; absent for a new one. */
		chapter?: Chapter | null;
		/** A new chapter's proposed start. */
		start?: string;
		/** The chapter a new one is started from: its lineup is offered, not inherited. */
		from?: Chapter | null;
	}>;
	let { workbench, chapter = null, start = '', from = null }: Props = $props();

	const store = $derived(workbench.chapters);
	const now = untrack(() => workbench.chapters.now);
	const zone = untrack(() => workbench.chapters.timeZone);
	/** A new chapter's hue: the one farthest from every Scope and chapter hue in use. */
	const hue = (): number =>
		freeHue(
			[...workbench.view.scopes, ...workbench.chapters.list].flatMap((item) =>
				item.colorHue === null ? [] : [item.colorHue]
			)
		);
	let name = $state(untrack(() => chapter?.name ?? ''));
	let note = $state(untrack(() => chapter?.note ?? ''));
	let colorHue = $state<number | null>(untrack(() => (chapter ? chapter.colorHue : hue())));
	let colorChroma = $state<number | null>(untrack(() => (chapter ? chapter.colorChroma : 80)));
	let colorDepth = $state<number | null>(untrack(() => (chapter ? chapter.colorDepth : 2)));
	/** The chapter's time as the TimeInput component sets it: a start, and an end only when closed early. */
	let span = $state.raw<TimeSpan>(
		untrack(() => ({
			start: ms(chapter?.start ?? start),
			end: chapter?.closedAt ? ms(chapter.closedAt) : null
		}))
	);
	/**
	 * A full rebuild (owner, round 2): a new chapter starts with an empty lineup; the previous
	 * one's Scopes lead both pickers, offered, not inherited.
	 */
	let lineup = $state.raw<Lineup>(untrack(() => chapter?.lineup ?? []));
	let confirmEnd = $state(true);
	let saving = $state(false);
	let failure = $state.raw<unknown>(null);

	const startMs = $derived(span.start);
	const others = $derived(store.list.filter((item) => item.id !== chapter?.id));
	const plan = $derived(startMs === null ? null : planInsert(others, startMs));
	/** An edited chapter starts before the chapter after it, whatever its own close says. */
	const ownEnd = $derived.by(() => {
		if (!chapter) return null;
		const following = sortChapters(others).find((item) => ms(item.start) > ms(chapter.start));
		return following ? ms(following.start) : null;
	});
	const problem = $derived(
		chapterProblem(name, startMs, plan, ownEnd, confirmEnd, chapter, span.end)
	);

	const pickColour = (colour: ScopeColour | null): void => {
		colorHue = colour?.hue ?? null;
		colorChroma = colour?.chroma ?? null;
		colorDepth = colour?.depth ?? null;
	};

	/** A write of the form: the chapter chosen after it, a refusal shown under the form. */
	const run = async (write: () => Promise<string | null>): Promise<void> => {
		if (saving) return;
		saving = true;
		failure = null;
		try {
			const id = await write();
			if (id) workbench.selectChapter(id);
			else workbench.rest();
		} catch (cause: unknown) {
			failure = cause;
		} finally {
			saving = false;
		}
	};

	const save = (): void => {
		if (problem) return;
		const fields = {
			name: name.trim(),
			note: note.trim(),
			colorHue,
			colorChroma,
			colorDepth,
			start: msToIso(span.start, zone),
			closedAt: span.end === null ? null : msToIso(span.end, zone),
			lineup
		};
		void run(async () =>
			chapter ? (await store.save(chapter, fields)).id : (await store.create(fields)).id
		);
	};

	const remove = (): void => {
		if (chapter) void run(async () => (await store.remove(chapter.id), null));
	};
</script>

{#snippet plainPicker()}
	<ColorHuePicker
		hue={colorHue}
		chroma={colorChroma}
		depth={colorDepth}
		label={t('chapter.colour')}
		testId="chapter-colour"
		onpick={pickColour}
	/>
{/snippet}

<EditorShell
	heading={chapter ? t('chapter.editTitle') : t('chapter.new')}
	testId="chapter-editor"
	busy={saving}
>
	<label class="grid gap-1 text-sm"
		>{t('chapter.name')}<input
			class="cg-control cg-field"
			data-testid="chapter-name"
			placeholder={t('chapter.namePlaceholder')}
			bind:value={name}
		/></label
	>
	<label class="grid gap-1 text-sm"
		>{t('chapter.note')}<textarea
			class="cg-control cg-field"
			data-testid="chapter-note-input"
			placeholder={t('chapter.notePlaceholder')}
			bind:value={note}></textarea></label
	>
	<svelte:boundary>
		{#if browser}
			<ColorBlossomPicker
				hue={colorHue}
				chroma={colorChroma}
				depth={colorDepth}
				label={t('chapter.colour')}
				testId="chapter-colour"
				onpick={pickColour}
			/>
		{:else}
			{@render plainPicker()}
		{/if}
		{#snippet failed()}{@render plainPicker()}{/snippet}
	</svelte:boundary>
	<!-- The start only (owner 2026-09-28): a chapter ends where the next begins, or by «Закрыть
	     главу»; a closed one says so here and can be opened again. -->
	<TimeSpanField
		label={t('chapter.startLabel')}
		span={{ start: span.start, end: null }}
		testId="chapter-time"
		onchange={(next) => (span = { start: next.start, end: span.end })}
	/>
	{#if span.end !== null}
		<div class="flex items-center gap-2 text-sm" data-testid="chapter-closed">
			<span class="grow text-muted"
				>{t('chapter.closedAt', { moment: formatMoment(span.end, zone, locale.current) })}</span
			>
			<Button
				size="sm"
				variant="quiet"
				data-testid="chapter-reopen"
				onclick={() => (span = { start: span.start, end: null })}>{t('chapter.reopen')}</Button
			>
		</div>
	{/if}
	<LineupFields
		{lineup}
		view={workbench.view}
		testId="chapter-lineup"
		offered={!chapter && from
			? { label: t('chapter.previousLineupOf', { name: from.name }), ids: idsAt(from.lineup) }
			: null}
		onchange={(next) => (lineup = next)}
	/>
	{#if plan?.ends}
		<label class="flex items-start gap-2 text-sm" data-testid="chapter-ends-confirm">
			<input type="checkbox" class="mt-1" bind:checked={confirmEnd} />
			<span
				>{t(statusAt(plan.ends, now) === 'current' ? 'chapter.endsCurrent' : 'chapter.endsOther', {
					name: plan.ends.name,
					moment: formatMoment(startMs, zone, locale.current)
				})}</span
			>
		</label>
	{/if}
	{#if !chapter && plan?.until}
		<p class="text-sm text-muted" data-testid="chapter-until">
			{t('chapter.until', {
				moment: formatMoment(ms(plan.until.start), zone, locale.current),
				name: plan.until.name
			})}
		</p>
	{:else if !chapter && plan && !plan.until}
		<p class="text-sm text-muted">{t('chapter.openEnd')}</p>
	{/if}
	{#snippet alerts()}
		{#if problem && name.trim()}<p role="alert" class="text-sm">
				{t(problem.key, { name: problem.name })}
			</p>{:else if failure !== null}<p role="alert" class="text-sm">{errorText(failure)}</p>{/if}
	{/snippet}
	{#snippet actions()}
		<Button
			variant="primary"
			disabled={problem !== null || saving}
			data-testid="chapter-save"
			onclick={save}>{chapter ? t('chapter.save') : t('chapter.start')}</Button
		>
		<Button onclick={() => store.closeForm()}>{t('common.cancel')}</Button>
		{#if chapter}<Button
				variant="quiet"
				class="ml-auto"
				data-testid="chapter-delete"
				onclick={remove}>{t('chapter.delete')}</Button
			>{/if}
	{/snippet}
</EditorShell>
