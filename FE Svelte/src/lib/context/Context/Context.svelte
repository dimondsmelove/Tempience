<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { getTimeInputHost } from '$lib/ui/TimeInput/host.svelte';
	import { CloseOutline } from 'flowbite-svelte-icons';
	import EntityView from '$lib/context/EntityView/EntityView.svelte';
	import TraceForms from '$lib/forms/TraceForms/TraceForms.svelte';
	import Capture from '$lib/context/Capture/Capture.svelte';
	import DeletedRecords from '$lib/context/Deleted/DeletedRecords.svelte';
	import DeletedScope from '$lib/context/Deleted/DeletedScope.svelte';
	import DeletedTrace from '$lib/context/Deleted/DeletedTrace.svelte';
	import { RestoreEpisodes } from '$lib/context/Deleted/restore.svelte';
	import PeriodView from '$lib/context/PeriodView/PeriodView.svelte';
	import ProposalView from '$lib/context/ProposalView/ProposalView.svelte';
	import NewScope from '$lib/context/ScopeEditor/NewScope.svelte';
	import ScopeView from '$lib/context/ScopeView/ScopeView.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { RecordsReader } from '$lib/state/Records/Records.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { displayedTrace } from '$lib/state/Workbench/display';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { explorerTraceOf } from '$lib/state/Workbench/snapshot';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { untrack } from 'svelte';
	import type { ContextTab } from './constants';
	import TraceView from './TraceView.svelte';
	import { readCollapsed, writeCollapsed } from './sections';

	const timeInput = getTimeInputHost();

	type Props = Readonly<{
		workbench: WorkbenchState;
		/** Desktop: Обзор, Связи and Окрестность stack as foldable sections instead of tabs (C9a-1). */
		sections?: boolean;
		onclose: () => void;
		onexpand?: () => void;
	}>;
	let { workbench, sections = false, onclose, onexpand }: Props = $props();
	let tab = $state<ContextTab>('overview');
	let collapsed = $state(readCollapsed());
	const selection = $derived(workbench.selection);
	/**
	 * The one reader of the selected record, beyond the active snapshot and following the
	 * replica: every part of the Context reads the record through it, and what it knows —
	 * whether the record is here, deleted, or changed on another device — decides which panel
	 * is shown and what that panel is shown. A reloaded timeline reads it again, because the
	 * Kinds and Scopes it names are not followed; a redisplay in another language is no reload.
	 */
	const records = new RecordsReader(tempienceRepository);
	// A language switch renames what the answer holds; nothing is read again for it.
	$effect(() => {
		void locale.current;
		untrack(() => records.redisplay());
	});
	$effect(() => {
		const id = selection.traceId;
		// A proposal under review is the timeline's own row; the repository has nothing to read.
		if (!id || workbench.proposalOf(id)) return;
		void workbench.loaded;
		// Neither the read nor the following is an input of this effect: what the reader shows
		// is read by the parts below, and must not start the reading again.
		untrack(() => void records.load(id));
		return untrack(() => records.watch());
	});
	const known = $derived(
		selection.traceId && records.result?.traceId === selection.traceId ? records.result : null
	);
	const listed = $derived(
		selection.traceId
			? (workbench.view.traces.find((item) => item.id === selection.traceId) ?? null)
			: null
	);
	/** An open edit of this record keeps its panel: the draft in it is the form's own to end. */
	const editing = $derived(
		selection.traceId !== null && workbench.forms.editingId === selection.traceId
	);
	/**
	 * The record the ordinary panel shows, or null when there is none to show that way: the
	 * live record when the reader has answered for it — as it is now, mapped like the timeline
	 * maps its own — else the timeline's own row until the reader answers. An open edit keeps
	 * the timeline's row while there is one; a record the timeline does not list yet — written
	 * while a table stood in the centre — is edited as the reader knows it.
	 */
	const trace = $derived.by(() => {
		if (!selection.traceId) return null;
		if (workbench.proposalOf(selection.traceId)) return listed;
		if (!known || (editing && listed)) return listed;
		if (!known.trace || known.trace.isDeleted) return null;
		const origin = { kind: 'canonical' as const, sourceId: activeDataSpace.id };
		const live = explorerTraceOf(known.trace, origin);
		return records.catalog ? displayedTrace(live, records.catalog, locale.current) : live;
	});
	/**
	 * The restore of the selected record, owned here because its panel does not outlive it: one
	 * per deletion, so a record deleted again while still selected has a way back again.
	 */
	const restores = new RestoreEpisodes(() => ({
		repository: tempienceRepository,
		workbench,
		records,
		loader: loadWorkbenchSnapshot
	}));
	/** The deletion shown, by the record's lifecycle revision; null while it is here or unread. */
	const deletion = $derived(
		known?.trace?.isDeleted ? (known.trace.lifecycleId ?? 'unstamped') : null
	);
	const restore = $derived(restores.for(selection.traceId, deletion));
	const toggle = (id: ContextTab): void => {
		collapsed[id] = !collapsed[id];
		writeCollapsed($state.snapshot(collapsed));
	};
</script>

<header
	class={[
		'cg-toolbar flex shrink-0 flex-wrap items-center border-b border-outline bg-surface',
		timeInput?.editor && 'time-context-heading'
	]}
	data-sheet-drag-handle={onexpand ? true : undefined}
>
	<span class="text-[length:var(--cg-text-size-control)] font-semibold">Context</span>
	<Button
		size="sm"
		variant="quiet"
		icon
		aria-label={t('context.back')}
		disabled={!selection.canBack}
		data-testid="history-back"
		onclick={() => workbench.back()}>←</Button
	>
	<span
		class="shrink-0 font-mono text-xs whitespace-nowrap text-muted"
		data-testid="history-position">{selection.position.n ?? '—'} / {selection.position.m}</span
	>
	<Button
		size="sm"
		variant="quiet"
		icon
		aria-label={t('context.forward')}
		disabled={!selection.canForward}
		data-testid="history-forward"
		onclick={() => workbench.forward()}>→</Button
	>
	<div class="grow"></div>
	{#if onexpand}<Button icon variant="quiet" aria-label={t('context.resize')} onclick={onexpand}
			>↕</Button
		>{/if}
	{#if selection.current}
		<Button
			size="sm"
			variant="quiet"
			title={t('context.restTitle')}
			data-testid="context-rest"
			onclick={() => workbench.rest()}>{t('context.rest')}</Button
		>
	{/if}
	<Button
		size="sm"
		variant="quiet"
		icon
		aria-label={t('context.close')}
		title={t('context.close')}
		data-testid="context-collapse"
		onclick={onclose}
	>
		<CloseOutline class="h-4 w-4" />
	</Button>
</header>
<!-- The navigator on the right (DESIGN.md §8): capture, a period, a record with its parts, or the neutral placeholder at rest. -->
<div
	class={[
		'cg-panel flex min-h-0 flex-1 flex-col gap-3 overflow-auto',
		timeInput?.editor && 'time-context-body'
	]}
	data-testid="context-body"
>
	{#if restore?.committed && restore.readFailure}
		<!-- The record is back; what could not be read after that is said until it is read. -->
		<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="restore-not-shown">
			{t('deleted.restoredNotShown', { message: errorText(restore.readFailure) })}
			<Button
				size="sm"
				variant="quiet"
				disabled={restore.busy}
				data-testid="restore-retry"
				onclick={() => void restore.retry()}>{t('kind.retryLoad')}</Button
			>
		</p>
	{/if}
	{#if workbench.forms.open}
		<TraceForms
			bind:kindId={workbench.forms.kindId}
			newKindScopes={workbench.forms.newKindScopeIds ?? undefined}
			ondata={(kindId, versionId) => workbench.forms.showData(kindId, versionId)}
			oncapture={(kindId, versionId) => workbench.openCapture({ kindId, versionId })}
		/>
	{:else if workbench.forms.newScope}
		{#key workbench.forms.newScope.parentId}<NewScope
				{workbench}
				parentId={workbench.forms.newScope.parentId}
			/>{/key}
	{:else if workbench.capture}
		{#key workbench.forms.captureRevision}<Capture {workbench} />{/key}
	{:else if selection.entityId}
		<EntityView {workbench} entityId={selection.entityId} />
	{:else if selection.scopeId}
		{#key selection.scopeId}
			{#if workbench.scopeContext}
				<ScopeView {workbench} />
			{:else}
				<!-- Chosen, but not on the timeline: a deleted Scope, or one this replica lacks. -->
				<DeletedScope {workbench} scopeId={selection.scopeId} />
			{/if}
		{/key}
	{:else if selection.period}
		<PeriodView {workbench} period={selection.period} />
	{:else if trace && workbench.proposalOf(trace.id)}
		<ProposalView {workbench} traceId={trace.id} />
	{:else if trace}
		{#key trace.id}
			<TraceView {workbench} {trace} {records} {sections} bind:tab {collapsed} ontoggle={toggle} />
		{/key}
	{:else if selection.traceId && restore}
		<!-- Chosen, but not an ordinary record now: deleted, here or on another device, or not
		     on this replica at all. -->
		{#key selection.traceId}
			<DeletedTrace {workbench} traceId={selection.traceId} {records} {restore} />
		{/key}
	{:else}
		<div class="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
			<b class="font-medium text-ink">{t('context.pick')}</b>
			<span class="text-sm">{t('context.pickHint')}</span>
			<DeletedRecords {workbench} />
		</div>
	{/if}
</div>

<style>
	.time-context-heading {
		display: none;
	}
	.time-context-body {
		padding: 0;
		overflow: hidden;
		gap: 0;
	}
	.time-context-body :global([data-testid='context-capture']),
	.time-context-body :global([data-testid='context-trace']),
	.time-context-body :global([data-testid='edit-trace-form']) {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
		gap: 0;
		padding: 0;
		border: 0;
	}
	.time-context-body :global([data-testid='context-trace'] > h2),
	.time-context-body :global([data-testid='context-capture'] > h2) {
		display: none;
	}
</style>
