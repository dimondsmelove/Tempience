<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import type { MessageKey } from '$lib/state/Locale/types';
	import type { Snippet } from 'svelte';
	import { ChevronDownOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import { CHIP_CLASS, LIST_BUTTON_CLASS, SECTION_HEADING_CLASS } from '$lib/context/constants';
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
	import {
		PERIOD_SECTIONS,
		readPeriodCollapsed,
		writePeriodCollapsed,
		type PeriodSection
	} from './sections';

	let { workbench, period }: { workbench: WorkbenchState; period: PeriodRef } = $props();
	const context = $derived(periodContext(workbench.view, period, workbench.projectionInputs));
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
	let collapsed = $state(readPeriodCollapsed());
	const toggle = (id: PeriodSection): void => {
		collapsed[id] = !collapsed[id];
		writePeriodCollapsed($state.snapshot(collapsed));
	};
	const sectionTitle = (id: PeriodSection, label: string): string =>
		id === 'records' ? `${label} · ${context.traceCount}` : label;
	let draft = $state('');
	let editing = $state(false);
	let busy = $state(false);
	let notice = $state<MessageKey | null>(null);
	let failure = $state.raw<unknown>(null);
	/** «Заметка» stands while the period has a note, and while one is being written. */
	const noteShown = $derived(Boolean(context.note) || editing);
	const edit = (): void => {
		draft = context.note ?? '';
		editing = true;
		notice = null;
		failure = null;
		// The first note of a period: its section appears, and open, whatever was remembered.
		if (collapsed.note) toggle('note');
	};
	/** The note lives on the persisted Period; the first note creates it for this calendar period. */
	const save = async (): Promise<void> => {
		busy = true;
		notice = null;
		failure = null;
		try {
			const note = draft.trim() || null;
			if (context.record) await tempienceRepository.editPeriod(context.record.id, { note });
			else if (note)
				await tempienceRepository.createPeriod({
					name: context.title,
					time: periodDraftTime(period),
					timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
					note
				});
			await workbench.load(loadWorkbenchSnapshot);
			editing = false;
			notice = 'period.noteSaved';
		} catch (cause) {
			failure = cause ?? new Error();
		} finally {
			busy = false;
		}
	};
	const go = (ref: PeriodRef): void => workbench.selectPeriod(ref, 'context');
	const shown = $derived(
		PERIOD_SECTIONS.filter(
			(entry) =>
				(entry.id !== 'note' || noteShown) && (entry.id !== 'scopes' || context.activeScopes.length)
		)
	);
</script>

{#snippet section(id: PeriodSection, label: string, body: Snippet)}
	<section
		class="flex flex-col gap-2 border-t border-outline pt-2 first:border-t-0 first:pt-0"
		id={`context-section-${id}`}
		data-testid={`context-section-${id}`}
	>
		<div class="flex items-center justify-between gap-1">
			<h3 class={SECTION_HEADING_CLASS}>{sectionTitle(id, label)}</h3>
			<Button
				size="sm"
				variant="quiet"
				icon
				aria-expanded={!collapsed[id]}
				aria-label={collapsed[id]
					? t('context.expand', { section: label })
					: t('context.collapse', { section: label })}
				data-testid={`section-toggle-${id}`}
				onclick={() => toggle(id)}
			>
				{#if collapsed[id]}<ChevronRightOutline class="h-4 w-4" />{:else}<ChevronDownOutline
						class="h-4 w-4"
					/>{/if}
			</Button>
		</div>
		{#if !collapsed[id]}{@render body()}{/if}
	</section>
{/snippet}

{#snippet status()}
	{#if failure !== null}<p class="text-xs text-muted" role="alert">{errorText(failure)}</p>
	{:else if notice}<p class="text-xs text-muted" role="status">{t(notice)}</p>{/if}
{/snippet}

<!-- A dot before the name of a period that has a note, the mark the axis draws as a bar. -->
{#snippet noteDot(ref: PeriodRef)}
	{#if noted(ref)}<span class="note-dot" aria-hidden="true"></span>{/if}
{/snippet}

{#snippet overview()}
	<span class="font-mono text-xs text-muted"
		>{t('period.records', { unit: t(UNIT_KEYS[period.unit]), count: context.traceCount })}</span
	>
	<h2 class="text-lg leading-tight font-semibold" data-testid="selected-title">{context.title}</h2>
	{#if !noteShown}
		<div>
			<Button size="sm" variant="quiet" data-testid="period-note-add" onclick={edit}
				>{t('period.addNote')}</Button
			>
		</div>
		{@render status()}
	{/if}
{/snippet}

{#snippet note()}
	<div class="flex flex-col gap-1" data-testid="period-note">
		{#if editing}
			<textarea
				class="cg-field min-h-24 w-full text-sm"
				aria-label={t('period.note')}
				bind:value={draft}
				disabled={busy}></textarea>
			<div class="flex gap-1">
				<Button size="sm" variant="primary" disabled={busy} onclick={save}
					>{t('period.save')}</Button
				>
				<Button size="sm" variant="quiet" disabled={busy} onclick={() => (editing = false)}
					>{t('common.cancel')}</Button
				>
			</div>
		{:else}
			<p class="text-sm whitespace-pre-wrap">{context.note}</p>
			<div><Button size="sm" variant="quiet" onclick={edit}>{t('period.editNote')}</Button></div>
		{/if}
		{@render status()}
	</div>
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
			{#each context.records as item (item.traceId)}
				{@const lit = emphasis.traceIds.has(item.traceId)}
				<li
					class="row"
					data-collapsed={fade.folded.has(item.traceId) ? 'true' : undefined}
					data-dimmed={fade.dimmedTraceIds.has(item.traceId) ? 'true' : undefined}
					{...rest('trace', item.traceId)}
				>
					<div class="fold">
						<button
							type="button"
							class={[LIST_BUTTON_CLASS, lit && 'lit']}
							data-testid="period-record"
							data-trace-id={item.traceId}
							data-lit={lit ? 'true' : undefined}
							onclick={() => workbench.selectTrace(item.traceId, 'context')}
							{@attach lensSource(workbench.hover, { kind: 'trace', traceId: item.traceId })}
						>
							<span class="font-mono text-xs text-muted">{formatDay(item.time.start)}</span>
							<span>{item.label}</span>
						</button>
					</div>
				</li>
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
		<div class="flex flex-wrap gap-1">
			{#each context.neighbors.children as child (child.start)}
				<button
					type="button"
					class={CHIP_CLASS + ' cursor-pointer hover:text-ink'}
					data-testid="period-child"
					data-note={noted(child) || undefined}
					onclick={() => go(child)}
					{@attach lensSource(workbench.hover, { kind: 'period', period: child })}
					>{@render noteDot(child)}{periodTitle(child, locale.current)}</button
				>
			{/each}
		</div>
	{/if}
{/snippet}

<!-- The same foldable sections as a record's and a Scope's Context (owner 2026-09-20): Обзор,
     Заметка while there is one, Активные Scope, Записи with the count, Окрестность периода. -->
<section class="flex flex-col gap-3" data-testid="context-period">
	{#each shown as entry (entry.id)}
		{@render section(
			entry.id,
			t(entry.label),
			entry.id === 'overview'
				? overview
				: entry.id === 'note'
					? note
					: entry.id === 'scopes'
						? scopes
						: entry.id === 'records'
							? records
							: neighborhood
		)}
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
	/* The emphasis of the hover linking (pack 3, P4): a 2 px accent underline with rounded ends
	   along the row's bottom edge, the same one the chip carries when lit; drawn inside the box,
	   so nothing reflows and what is under the pointer stays under it. */
	.lit {
		position: relative;
	}
	.lit::after {
		content: '';
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: 0;
		height: 2px;
		border-radius: 1px;
		background: var(--cg-accent);
		pointer-events: none;
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
