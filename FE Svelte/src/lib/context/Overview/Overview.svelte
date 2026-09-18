<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import Belongings from '$lib/context/Belongings/Belongings.svelte';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { DraftPreset } from '$lib/state/TraceDraft/types';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { offerUndo } from '$lib/context/undo';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import type { SupplementState } from '$lib/state/triplit/Traces/supplement';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { SUPPLEMENT_KEYS } from '$lib/context/TraceEditor/supplement';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import {
		AnnotationOutline,
		CheckCircleOutline,
		TrashBinOutline,
		LayersOutline,
		LinkOutline,
		PenOutline
	} from 'flowbite-svelte-icons';
	import { ACTIONS } from './constants';

	type Props = Readonly<{
		workbench: WorkbenchState;
		trace: ExplorerTrace;
		/** What this record is as a supplement, as the one reader of it answered. */
		supplement: SupplementState | null;
		onlinks: () => void;
		onedit: () => void;
	}>;
	let { workbench, trace, supplement, onlinks, onedit }: Props = $props();
	let busy = $state(false);
	/** A refused command is said here; the record stays exactly as it is. */
	let failure = $state.raw<unknown>(null);
	/** The record's text as stored: a plain description, or a typed record's own content. */
	const description = $derived(
		trace.kindId === null ? (trace.description ?? null) : trace.content || null
	);
	/** «15 июл 2026, 20:20»: the placement chips moved to the technical section (owner, 2026-09-15). */
	const timeLine = $derived(traceTimeLabel(trace, locale.current).replace(' г.', ''));
	/** A new record from this one: a result for an intention, a part, a supplement (TRACE_FORMS «входы»). */
	const startWith = (start: DraftPreset): void => workbench.openCapture({ start });
	/** DP22 «удалить везде»: a soft delete the toast can take back (DP23). */
	const remove = async (): Promise<void> => {
		busy = true;
		const id = trace.id;
		const outcome = await offerUndo({
			undo: workbench.undo,
			space: activeDataSpace.id,
			repository: tempienceRepository,
			label: () => t('overview.deleted'),
			write: async () => {
				// A record another device already deleted names no operation: nothing is offered.
				const { operation } = await tempienceRepository.setTraceDeleted(id, true, 'user');
				workbench.selection.clear();
				return { operationId: operation?.id ?? null };
			},
			// The workbench keeps a refused read in its own status; this is the seam that raises it.
			read: () => reloadForSaved(workbench, loadWorkbenchSnapshot),
			// The record is back: it is shown again, where it was before it went.
			restored: () => workbench.selection.select({ kind: 'trace', traceId: id }, 'canvas')
		});
		// A refusal means the record is untouched and this panel is still here to say so;
		// a reading that failed after the deletion is the workbench's own state to show.
		failure = outcome.refusal;
		busy = false;
	};
</script>

<!-- Title first, then one mono line: when, kind, relation, precision, certainty (DESIGN.md §8, C9a-1). -->
<section class="flex flex-col gap-3" data-testid="context-overview">
	<h2 class="text-lg leading-snug font-semibold break-words" data-testid="selected-title">
		{trace.displayTitle ?? trace.content}
	</h2>
	<p class="font-mono text-xs text-muted" data-testid="selected-time">{timeLine}</p>
	{#if supplement}
		<!-- A supplement is placed by its original; what it is now is said, never guessed. -->
		<p
			class={[
				'text-xs',
				supplement.status === 'valid' ? 'text-muted' : 'text-[color:var(--cg-danger)]'
			]}
			role={supplement.status === 'valid' ? undefined : 'alert'}
			data-testid="supplement-status"
			data-status={supplement.status}
		>
			{t(SUPPLEMENT_KEYS[supplement.status])}
		</p>
	{/if}
	{#if trace.kindLabel}<p class="text-xs text-muted">
			{t('overview.version', { kind: trace.kindLabel, generation: trace.kindGeneration })}
		</p>{/if}
	{#if trace.displayFields?.length}
		<dl class="grid gap-3 border-y border-outline py-3 text-sm">
			{#each trace.displayFields as field, index (index)}<div>
					<dt class="mb-1 text-xs text-muted">{field.label}</dt>
					<dd class="font-medium break-words whitespace-pre-wrap">{field.value}</dd>
				</div>{/each}
		</dl>
	{/if}
	{#if description}<p class="text-sm whitespace-pre-wrap" data-testid="selected-description">
			{description}
		</p>{/if}
	<!-- One row of icons; the name of each action is its tooltip and its accessible name. -->
	<div class="flex items-center gap-1" role="group" aria-label={t('overview.actions')}>
		<Button
			size="sm"
			icon
			aria-label={t(ACTIONS.edit)}
			title={t(ACTIONS.edit)}
			data-testid="edit-trace"
			onclick={onedit}><PenOutline class="h-4 w-4" /></Button
		>
		<Button size="sm" icon aria-label={t(ACTIONS.link)} title={t(ACTIONS.link)} onclick={onlinks}
			><LinkOutline class="h-4 w-4" /></Button
		>
		{#if trace.relation === 'intend'}
			<Button
				size="sm"
				icon
				aria-label={t('context.addResult')}
				title={t('context.addResult')}
				data-testid="add-result"
				onclick={() => startWith({ kind: 'result', intentionId: trace.id })}
				><CheckCircleOutline class="h-4 w-4" /></Button
			>
		{/if}
		<Button
			size="sm"
			icon
			aria-label={t('context.addPart')}
			title={t('context.addPart')}
			data-testid="add-part"
			onclick={() => startWith({ kind: 'part', wholeId: trace.id })}
			><LayersOutline class="h-4 w-4" /></Button
		>
		<Button
			size="sm"
			icon
			aria-label={t('context.supplement')}
			title={t('context.supplement')}
			data-testid="add-supplement"
			onclick={() => startWith({ kind: 'supplement', originalId: trace.id })}
			><AnnotationOutline class="h-4 w-4" /></Button
		>
		<Button
			size="sm"
			icon
			variant="quiet"
			disabled={busy}
			aria-label={t(ACTIONS.delete)}
			title={t(ACTIONS.delete)}
			data-testid="delete-trace"
			onclick={remove}><TrashBinOutline class="h-4 w-4" /></Button
		>
		{#if failure}
			<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="delete-error"
				>{errorText(failure)}</span
			>
		{/if}
	</div>
	<Belongings {workbench} {trace} />
</section>
