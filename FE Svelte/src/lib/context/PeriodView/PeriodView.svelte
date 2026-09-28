<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import ChildList from '$lib/context/ChildList/ChildList.svelte';
	import ContextNote from '$lib/context/ContextNote/ContextNote.svelte';
	import { NoteEditing } from '$lib/context/ContextNote/NoteEditing.svelte';
	import NoteStatus from '$lib/context/ContextNote/NoteStatus.svelte';
	import ContextSection from '$lib/context/ContextSection/ContextSection.svelte';
	import { FoldedSections } from '$lib/context/ContextSection/FoldedSections.svelte';
	import ContextTitle from '$lib/context/ContextTitle/ContextTitle.svelte';
	import RecordGroupHead from '$lib/context/RecordList/RecordGroupHead.svelte';
	import RecordRow from '$lib/context/RecordList/RecordRow.svelte';
	import { GROUP_UNDER } from '$lib/model/RecordGroups/constants';
	import { groupRecords, recordShape } from '$lib/model/RecordGroups/RecordGroups';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import { formatDay } from '$lib/context/labels';
	import { periodTitle } from '$lib/model/Axis/Axis';
	import type { PeriodRef } from '$lib/model/Axis/types';
	import {
		notedPeriods,
		periodContext,
		periodDraftTime,
		periodEmphasis,
		periodFade
	} from '$lib/model/PeriodContext/PeriodContext';
	import type { PeriodFocus } from '$lib/model/PeriodContext/types';
	import { tempienceRepository } from '$lib/state/triplit';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { lensSource } from '$lib/ui/LensSource';
	import { UNIT_KEYS } from './constants';
	import { PERIOD_SECTIONS, PERIOD_SECTIONS_STORAGE_KEY, type PeriodSection } from './sections';

	let { workbench, period }: { workbench: WorkbenchState; period: PeriodRef } = $props();
	const context = $derived(periodContext(workbench.view, period, workbench.projectionInputs));
	/**
	 * The records cut by the unit under the period: a month by weeks, a year by months, a week by
	 * days. One that began earlier and runs into the period stands in its first stretch.
	 */
	const groups = $derived(
		groupRecords(
			context.records.map((record) => ({
				...record,
				at: Math.max(record.time.start, period.start)
			})),
			GROUP_UNDER[period.unit],
			locale.current
		)
	);
	/** How many of the period's records each active Scope holds: the count in its chip. */
	const scopeCounts = $derived(
		new Map(
			context.activeScopes.map((scope) => [
				scope.id,
				context.records.filter((record) => record.scopes.some((item) => item.id === scope.id))
					.length
			])
		)
	);
	/** Which neighbouring periods carry a note: a dot before their name, as the axis bars them. */
	const noted = $derived(notedPeriods(workbench.view.periods));
	/**
	 * Hover linking (п. 26): the pointer and the keyboard focus each remember what they rest
	 * on; the pointer wins while it is over something. A pure helper turns that into the set
	 * of lit records and lit chips.
	 */
	let hovered = $state.raw<PeriodFocus>(null);
	let focused = $state.raw<PeriodFocus>(null);
	const emphasis = $derived(periodEmphasis(context.records, hovered ?? focused));
	/** What gives way under the focus (C3, B): the folded records, the dimmed records and chips. */
	const fade = $derived(periodFade(context.records, context.activeScopes, hovered ?? focused));
	/**
	 * The list keeps its unfolded height while records are folded: were it to shrink, the chips
	 * below would slide out from under the pointer, unfold the list and slide back, without end.
	 */
	let listHeight = $state(0);
	/** What a chip lights on the ribbon (C3): the period's records in that Scope, not the whole Scope. */
	const chipLens = $derived(
		new Map(
			context.activeScopes.map((scope) => [
				scope.id,
				{
					kind: 'traces' as const,
					traceIds: [...periodEmphasis(context.records, { kind: 'scope', id: scope.id }).traceIds]
				}
			])
		)
	);
	const rest = (kind: 'scope' | 'trace', id: string) => ({
		onpointerenter: () => (hovered = { kind, id }),
		onpointerleave: () => (hovered = null),
		onfocusin: () => (focused = { kind, id }),
		onfocusout: () => (focused = null)
	});
	/** Folded sections are remembered across periods and reloads, like a record's and a Scope's Context. */
	const folds = new FoldedSections(
		PERIOD_SECTIONS.map((entry) => entry.id),
		PERIOD_SECTIONS_STORAGE_KEY
	);
	const sectionTitle = (id: PeriodSection, label: string): string =>
		id === 'records' ? `${label} · ${context.traceCount}` : label;
	/** The note lives on the persisted Period; the first note creates it for this calendar period. */
	const note = new NoteEditing(
		() => context.note ?? null,
		async (text) => {
			if (context.record) await tempienceRepository.editPeriod(context.record.id, { note: text });
			else if (text)
				await tempienceRepository.createPeriod({
					name: context.title,
					time: periodDraftTime(period),
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					note: text
				});
			await workbench.load(loadWorkbenchSnapshot);
		},
		'period.noteSaved'
	);
	/** «Заметка» stands while the period has a note, and while one is being written. */
	const noteShown = $derived(Boolean(context.note) || note.editing);
	const edit = (): void => {
		note.edit();
		// The first note of a period: its section appears, and open, whatever was remembered.
		folds.open('note');
	};
	const go = (ref: PeriodRef): void => workbench.selectPeriod(ref, 'context');
	const shown = $derived(
		PERIOD_SECTIONS.filter(
			(entry) =>
				(entry.id !== 'note' || noteShown) && (entry.id !== 'scopes' || context.activeScopes.length)
		)
	);
</script>

<!-- A dot before the name of a period that has a note, the mark the axis draws as a bar. -->
{#snippet noteDot(ref: PeriodRef)}
	{#if noted(ref)}<span class="note-dot" aria-hidden="true"></span>{/if}
{/snippet}

{#snippet overview()}
	<ContextTitle
		title={context.title}
		meta={t('period.records', { unit: t(UNIT_KEYS[period.unit]), count: context.traceCount })}
		leading="tight"
	/>
	{#if !noteShown}
		<div>
			<Button size="sm" variant="quiet" data-testid="period-note-add" onclick={edit}
				>{t('period.addNote')}</Button
			>
		</div>
		<NoteStatus editor={note} />
	{/if}
{/snippet}

{#snippet noteBlock()}
	<ContextNote
		text={context.note}
		editor={note}
		labels={{ note: t('period.note'), save: t('period.save'), edit: t('period.editNote') }}
		testId="period-note"
	/>
{/snippet}

{#snippet scopes()}
	<!-- Chips in the Scopes' colours; a chip leads to its Scope. Under the pointer or the
	     focus a chip lights the period's records that belong to it (a rounded accent
	     underline), and a record its chips. -->
	<ul class="flex flex-wrap gap-1" aria-label={t('period.activeScopes')}>
		{#each context.activeScopes as scope (scope.id)}
			<li
				class="chip max-w-full min-w-0"
				data-dimmed={fade.dimmedScopeIds.has(scope.id) ? 'true' : undefined}
				{...rest('scope', scope.id)}
			>
				<ScopeChip
					id={scope.id}
					name={scope.name}
					colorHue={scope.colorHue}
					colorChroma={scope.colorChroma}
					colorDepth={scope.colorDepth}
					lit={emphasis.scopeIds.has(scope.id)}
					lens={chipLens.get(scope.id) ?? null}
					count={scopeCounts.get(scope.id)}
					testId="active-scope"
					onopen={(id) => workbench.selectScope(id, 'context')}
				/>
			</li>
		{/each}
	</ul>
{/snippet}

{#snippet records()}
	{#if context.records.length}
		<!-- One record once, by time: date · title, nothing else in the row (owner review
		     2026-09-19, п. 26). Its Scopes show through the hover linking with «Активные Scope»
		     above; on touch a tap opens the record, whose Context names them. -->
		<ul
			class="flex flex-col gap-1"
			data-testid="period-list"
			style:min-height={fade.folded.size ? `${listHeight}px` : undefined}
			bind:clientHeight={listHeight}
		>
			{#each groups as part (`${part.key}:${part.items[0]?.traceId}`)}
				{#if part.label}
					<li
						class="row"
						data-collapsed={part.items.every((item) => fade.folded.has(item.traceId))
							? 'true'
							: undefined}
					>
						<div class="fold"><RecordGroupHead label={part.label} count={part.items.length} /></div>
					</li>
				{/if}
				{#each part.items as item (item.traceId)}
					{@const lit = emphasis.traceIds.has(item.traceId)}
					<li
						class="row"
						data-collapsed={fade.folded.has(item.traceId) ? 'true' : undefined}
						data-dimmed={fade.dimmedTraceIds.has(item.traceId) ? 'true' : undefined}
						{...rest('trace', item.traceId)}
					>
						<div class="fold">
							<RecordRow
								item={{
									traceId: item.traceId,
									date: formatDay(item.time.start),
									title: item.label,
									mark: {
										shape: recordShape(item.time),
										colours: item.scopes.map((scope) => chapterColour(scope, '')).filter(Boolean)
									}
								}}
								testId="period-record"
								{lit}
								titleClass=""
								onselect={(traceId) => workbench.selectTrace(traceId, 'context')}
							/>
						</div>
					</li>
				{/each}
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted">{t('period.empty')}</p>
	{/if}
{/snippet}

{#snippet neighborhood()}
	<div class="flex flex-wrap gap-1">
		<Button
			size="sm"
			data-testid="period-previous"
			data-note={noted(context.neighbors.previous) || undefined}
			onclick={() => go(context.neighbors.previous)}
			{@attach lensSource(workbench.hover, {
				kind: 'period',
				period: context.neighbors.previous
			})}
			>← {@render noteDot(context.neighbors.previous)}{periodTitle(
				context.neighbors.previous,
				locale.current
			)}</Button
		>
		{#if context.neighbors.parent}
			{@const parent = context.neighbors.parent}
			<Button
				size="sm"
				data-testid="period-parent"
				data-note={noted(parent) || undefined}
				onclick={() => go(parent)}
				{@attach lensSource(workbench.hover, { kind: 'period', period: parent })}
				>↑ {@render noteDot(parent)}{periodTitle(parent, locale.current)}</Button
			>
		{/if}
		<Button
			size="sm"
			data-testid="period-next"
			data-note={noted(context.neighbors.next) || undefined}
			onclick={() => go(context.neighbors.next)}
			{@attach lensSource(workbench.hover, { kind: 'period', period: context.neighbors.next })}
			>{@render noteDot(context.neighbors.next)}{periodTitle(
				context.neighbors.next,
				locale.current
			)} →</Button
		>
	</div>
	{#if context.neighbors.children.length}
		<ChildList
			items={context.neighbors.children.map((child) => ({
				key: String(child.start),
				label: periodTitle(child, locale.current),
				lens: { kind: 'period' as const, period: child },
				noted: noted(child),
				ref: child
			}))}
			testId="period-child"
			onpick={(item) => go(item.ref)}
		>
			{#snippet lead(item)}{@render noteDot(item.ref)}{/snippet}
		</ChildList>
	{/if}
{/snippet}

<!-- The same foldable sections as a record's and a Scope's Context (owner 2026-09-20): Обзор,
     Заметка while there is one, Активные Scope, Записи with the count, Окрестность периода. -->
<section class="flex flex-col gap-3" data-testid="context-period">
	{#each shown as entry (entry.id)}
		<ContextSection
			id={entry.id}
			label={t(entry.label)}
			title={sectionTitle(entry.id, t(entry.label))}
			collapsed={folds.collapsed[entry.id]}
			ontoggle={() => folds.toggle(entry.id)}
			flushFirst
		>
			{@render (entry.id === 'overview'
				? overview
				: entry.id === 'note'
					? noteBlock
					: entry.id === 'scopes'
						? scopes
						: entry.id === 'records'
							? records
							: neighborhood)()}
		</ContextSection>
	{/each}
</section>

<style>
	/* The list under a focus (loop 008, C3, B; owner 2026-09-19): under a chip the records of the
	   other Scopes fold away — a row is a grid track that closes over 160 ms — and the other chips
	   dim; under a record the other records dim over 120 ms and nothing moves. A folded row gives
	   back half the list's gap on each side, so the rows left draw together at the usual gap. */
	.row {
		display: grid;
		grid-template-rows: 1fr;
		transition:
			grid-template-rows 160ms ease-out,
			margin 160ms ease-out,
			opacity 120ms ease-out;
	}
	.fold {
		min-height: 0;
		overflow: hidden;
	}
	.row[data-collapsed] {
		grid-template-rows: 0fr;
		margin-block: -0.125rem;
		opacity: 0;
	}
	.chip {
		transition: opacity 120ms ease-out;
	}
	.row[data-dimmed],
	.chip[data-dimmed] {
		opacity: 0.35;
	}
	@media (prefers-reduced-motion: reduce) {
		.row,
		.chip {
			transition: none;
		}
	}
	/* A period with a note in the Окрестность: a 6 px accent dot before its name (loop 008 polish). */
	.note-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 0.375rem;
		border-radius: 9999px;
		background: var(--cg-accent);
		vertical-align: middle;
	}
</style>
