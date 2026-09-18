<script lang="ts">
	import { ArrowRightAltOutline, PenOutline } from 'flowbite-svelte-icons';
	import { formatDay } from '$lib/context/labels';
	import Retarget from '$lib/context/Retarget/Retarget.svelte';
	import { openKey, outcomeKey } from '$lib/context/TraceEditor/results';
	import type { WriteOutcome } from '$lib/context/write';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import type { IntentionSourceView } from '$lib/state/Records/result';
	import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import SourceEdit from './SourceEdit.svelte';
	import { INELIGIBLE_KEYS } from './constants';

	let {
		source,
		decides,
		workbench,
		records,
		read,
		onwritten
	}: {
		source: IntentionSourceView;
		/** Whether this statement decides the outcome and whether it decides the openness. */
		decides: readonly [boolean, boolean];
		workbench: WorkbenchState;
		records: RecordsReader;
		read: () => Promise<void>;
		onwritten: (outcome: WriteOutcome) => void;
	} = $props();
	const space = activeDataSpace.id;
	const factTitle = $derived(source.factSummary?.title ?? t('trace.unnamed'));
	const when = $derived(
		source.firstAssessedAt ? formatDay(new Date(source.firstAssessedAt).getTime()) : ''
	);
	/** The correction of a direct statement opens on its pencil and closes with it. */
	let editing = $state(false);
	const toggleEdit = (): void => {
		if (editing) resultInput.clear(space, source.id);
		editing = !editing;
	};
	const retargeting = $derived(
		source.evidenceId !== null && resultInput.retargetFor(space, source.evidenceId) !== null
	);
</script>

<!-- One statement addressed to this intention, in one line: when, through what, what it says,
     whether it is the one in effect; its corrections open under it on demand. -->
<div
	class="grid gap-1"
	data-testid="result-source"
	data-kind={source.kind}
	data-effective={source.effective ? 'true' : 'false'}
>
	<div class="flex min-w-0 items-center gap-2 text-sm">
		{#if when}<span class="shrink-0 font-mono text-xs text-muted">{when}</span>{/if}
		<span class="min-w-0 flex-1 truncate">
			{#if source.kind === 'direct'}
				{t('result.byDirectShort')}
			{:else}
				<button
					type="button"
					class="cursor-pointer underline decoration-dotted hover:text-accent"
					data-testid="source-fact"
					disabled={!source.factId}
					onclick={() => source.factId && workbench.selectTrace(source.factId, 'context')}
					>{t('result.byFact', { title: factTitle })}</button
				>
			{/if}
		</span>
		<span class="shrink-0 text-xs text-muted" data-testid="source-values">
			{t(outcomeKey(source.outcome))}{source.open === null ? '' : ` · ${t(openKey(source.open))}`}
		</span>
		{#if decides[0] || decides[1]}
			<span class="shrink-0 text-xs text-accent" data-testid="source-decides"
				>{t('result.effective')}</span
			>
		{/if}
		{#if source.kind === 'direct'}
			<Button
				size="sm"
				icon
				variant="quiet"
				pressed={editing}
				aria-label={t('source.edit')}
				title={t('source.edit')}
				data-testid="source-edit-toggle"
				onclick={toggleEdit}><PenOutline class="h-4 w-4" /></Button
			>
		{/if}
		{#if source.evidenceId}
			<Button
				size="sm"
				icon
				variant="quiet"
				pressed={retargeting}
				aria-label={t('result.retarget')}
				title={t('result.retarget')}
				data-testid="source-retarget"
				onclick={() =>
					retargeting
						? resultInput.closeRetarget(space)
						: resultInput.openRetarget(space, source.evidenceId!)}
				><ArrowRightAltOutline class="h-4 w-4" /></Button
			>
		{/if}
	</div>
	{#if source.reason}
		<p class="text-xs text-[color:var(--cg-danger)]" data-testid="source-inactive">
			{t(INELIGIBLE_KEYS[source.reason])}
		</p>
	{/if}
	{#if source.evidenceId}
		<Retarget
			{records}
			evidenceId={source.evidenceId}
			undo={workbench.undo}
			{read}
			{onwritten}
			trigger={false}
		/>
	{/if}
	{#if source.kind === 'direct' && editing}
		<SourceEdit {source} undo={workbench.undo} {read} {onwritten} />
	{/if}
</div>
