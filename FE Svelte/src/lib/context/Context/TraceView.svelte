<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { Snippet } from 'svelte';
	import { ChevronDownOutline, ChevronRightOutline } from 'flowbite-svelte-icons';
	import { SECTION_HEADING_CLASS } from '$lib/context/constants';
	import EditTrace from '$lib/context/EditTrace/EditTrace.svelte';
	import History from '$lib/context/History/History.svelte';
	import IntentionResult from '$lib/context/IntentionResult/IntentionResult.svelte';
	import Links from '$lib/context/Links/Links.svelte';
	import Neighborhood from '$lib/context/Neighborhood/Neighborhood.svelte';
	import Overview from '$lib/context/Overview/Overview.svelte';
	import SlotView from '$lib/context/SlotView/SlotView.svelte';
	import TechData from '$lib/context/TechData/TechData.svelte';
	import { DEFAULT_NEIGHBORHOOD_OPTIONS } from '$lib/model/Neighborhood/constants';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { CONTEXT_TABS, type ContextTab } from './constants';

	let {
		workbench,
		trace,
		records,
		sections,
		tab = $bindable(),
		collapsed,
		ontoggle
	}: {
		workbench: WorkbenchState;
		trace: ExplorerTrace;
		/** The Context's reader of this record, shared by every part that shows it. */
		records: RecordsReader;
		sections: boolean;
		tab: ContextTab;
		collapsed: Record<ContextTab, boolean>;
		ontoggle: (id: ContextTab) => void;
	} = $props();
	/** The edit form belongs to the workbench, so a layout change never ends it. */
	const editing = $derived(workbench.forms.editingId === trace.id);
	const linkCount = $derived(records.links.length);
	/**
	 * An intention carries a result of its own; an ordinary record has none. Which record this
	 * is comes from the timeline, not from the reader, so a refused read leaves the part in
	 * place with its own failure and retry instead of taking it away.
	 */
	const hasResult = $derived(trace.relation === 'intend');
	const result = $derived(records.result?.traceId === trace.id ? records.result.result : null);
	const parts = $derived(CONTEXT_TABS.filter((item) => item.id !== 'result' || hasResult));
	// A part that the shown record does not have never stays selected.
	$effect(() => {
		if (!parts.some((item) => item.id === tab)) tab = 'overview';
	});
	const { radius } = DEFAULT_NEIGHBORHOOD_OPTIONS;
	const sectionTitle = (id: ContextTab, label: string): string =>
		id === 'links'
			? `${label} · ${linkCount}`
			: id === 'result'
				? `${label} · ${result?.sources.length ?? 0}`
				: id === 'neighborhood'
					? `${label} · ${radius} + ${radius}`
					: label;
	/** The Overview's «Связанная запись…»: the links part opens with its search ready (ANSWERS Q6). */
	let linkSearch = $state(false);
	const showLinks = (): void => {
		linkSearch = true;
		if (!sections) {
			tab = 'links';
			return;
		}
		if (collapsed.links) ontoggle('links');
		document.getElementById('context-section-links')?.scrollIntoView({ block: 'start' });
	};
</script>

{#snippet section(id: ContextTab, label: string, body: Snippet)}
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
				onclick={() => ontoggle(id)}
			>
				{#if collapsed[id]}<ChevronRightOutline class="h-4 w-4" />{:else}<ChevronDownOutline
						class="h-4 w-4"
					/>{/if}
			</Button>
		</div>
		{#if !collapsed[id]}{@render body()}{/if}
	</section>
{/snippet}

<div class="flex min-h-0 flex-col gap-3" data-testid="context-trace">
	{#if editing}
		<h2 class="cg-heading">{t('context.editing')}</h2>
		<EditTrace {workbench} {trace} onclose={() => (workbench.forms.editingId = null)} />
	{:else}
		{#snippet overviewBody()}
			<Overview
				{workbench}
				{trace}
				supplement={records.result?.traceId === trace.id ? records.result.supplement : null}
				onlinks={showLinks}
				onedit={() => (workbench.forms.editingId = trace.id)}
			/>
			{#if workbench.slot}<SlotView {workbench} />{/if}
		{/snippet}
		{#snippet resultBody()}
			<IntentionResult {workbench} {records} />
		{/snippet}
		{#snippet linksBody()}
			<Links {workbench} traceId={trace.id} {records} bind:searchOpen={linkSearch} />
		{/snippet}
		{#snippet neighborhoodBody()}
			<Neighborhood {workbench} traceId={trace.id} />
		{/snippet}
		{#snippet historyBody()}
			<History {records} {workbench} />
		{/snippet}
		{#snippet techBody()}
			<TechData {trace} />
		{/snippet}
		{#if sections}
			{@render section('overview', t(CONTEXT_TABS[0].label), overviewBody)}
			{#if hasResult}{@render section('result', t(CONTEXT_TABS[1].label), resultBody)}{/if}
			{@render section('links', t(CONTEXT_TABS[2].label), linksBody)}
			{@render section('neighborhood', t(CONTEXT_TABS[3].label), neighborhoodBody)}
			{@render section('history', t(CONTEXT_TABS[4].label), historyBody)}
			{@render section('tech', t(CONTEXT_TABS[5].label), techBody)}
		{:else}
			<div
				role="tablist"
				aria-label={t('context.sections')}
				class="flex gap-1 border-b border-outline"
			>
				{#each parts as item (item.id)}
					<button
						type="button"
						role="tab"
						aria-selected={tab === item.id}
						class={[
							'-mb-px cursor-pointer border-b-2 px-2 py-1 text-sm',
							tab === item.id
								? 'border-accent text-ink'
								: 'border-transparent text-muted hover:text-ink'
						]}
						onclick={() => (tab = item.id)}>{t(item.label)}</button
					>
				{/each}
			</div>
			{#if tab === 'overview'}
				{@render overviewBody()}
			{:else if tab === 'result'}
				{@render resultBody()}
			{:else if tab === 'links'}
				{@render linksBody()}
			{:else if tab === 'history'}
				{@render historyBody()}
			{:else if tab === 'tech'}
				{@render techBody()}
			{:else}
				{@render neighborhoodBody()}
			{/if}
		{/if}
	{/if}
</div>
