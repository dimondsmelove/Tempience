<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { correctTarget } from '$lib/context/IntentionResult/actions';
	import type { WriteOutcome } from '$lib/context/write';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { IntentionCandidatesReader } from '$lib/state/Records/Candidates.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import type { UndoState } from '$lib/state/Undo/Undo.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { untrack } from 'svelte';

	let {
		records,
		evidenceId,
		undo,
		read,
		onwritten,
		trigger = true
	}: {
		records: RecordsReader;
		evidenceId: string;
		undo: UndoState;
		read: () => Promise<void>;
		onwritten: (outcome: WriteOutcome) => void;
		/** Whether this view offers its own opening button; the source row has an icon for it. */
		trigger?: boolean;
	} = $props();
	/** The step is held outside this view, so it survives the views that come and go. */
	const space = activeDataSpace.id;
	const step = $derived(resultInput.retargetFor(space, evidenceId));
	/**
	 * What the candidates are read for: the open step's space and link, as one value. The step
	 * itself is replaced on every keystroke of its query; an effect on the step would read the
	 * catalogs and every intention again for each letter, while the query only filters.
	 */
	const target = $derived(step ? `${step.space}\u0000${step.evidenceId}` : null);
	const busy = $derived(resultInput.busy);
	let failure = $state.raw<unknown>(null);
	/**
	 * The intentions to choose from are read when the step opens for a link, not with the
	 * record; again for another link, or once another record is the one corrected.
	 */
	const intentions = new IntentionCandidatesReader(tempienceRepository);
	$effect(() => {
		if (target === null) return;
		const except = records.traceId;
		untrack(() => void intentions.load(except));
	});
	const candidates = $derived.by(() => {
		const needle = (step?.query ?? '').trim().toLocaleLowerCase();
		return intentions.candidates.filter(
			(entry) => !needle || entry.title.toLocaleLowerCase().includes(needle)
		);
	});
	const retarget = async (intentionId: string): Promise<void> => {
		if (busy) return;
		failure = null;
		const outcome = await correctTarget(tempienceRepository, space, evidenceId, intentionId, read, {
			undo,
			label: () => t('result.retargeted')
		});
		failure = outcome.refusal;
		onwritten(outcome);
	};
</script>

<!-- Correcting the address of one link, with or without a statement made through it. -->
{#if step}
	<div class="grid gap-1 rounded border border-outline p-2" data-testid="retarget">
		<p class="text-xs text-muted">{t('result.retargetHint')}</p>
		<input
			class="cg-control cg-field text-sm"
			type="search"
			aria-label={t('result.retargetSearch')}
			placeholder={t('result.retargetSearch')}
			data-testid="retarget-search"
			disabled={busy}
			value={step.query}
			oninput={(event) => resultInput.search(space, event.currentTarget.value)}
		/>
		{#if failure}
			<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="retarget-error">
				{t('result.retargetFailed', { message: errorText(failure) })}
			</p>
		{/if}
		{#if intentions.error}
			<p role="alert" class="text-sm text-[color:var(--cg-danger)]">
				{t('link.readFailed', { message: intentions.error })}
			</p>
		{/if}
		{#if candidates.length}
			<ul class="grid max-h-56 gap-1 overflow-auto">
				{#each candidates as candidate (candidate.id)}
					<li>
						<Button
							size="sm"
							class="w-full justify-start text-left"
							disabled={busy}
							data-testid="retarget-candidate"
							onclick={() => void retarget(candidate.id)}>{candidate.title}</Button
						>
					</li>
				{/each}
			</ul>
		{:else if !intentions.loading}
			<p class="text-sm text-muted" data-testid="retarget-empty">{t('result.empty')}</p>
		{/if}
		<div>
			<Button
				size="sm"
				variant="quiet"
				disabled={busy}
				data-testid="retarget-close"
				onclick={() => resultInput.closeRetarget(space)}>{t('draft.close')}</Button
			>
		</div>
	</div>
{:else if trigger}
	<div>
		<!-- While a command is running no other step may replace the input behind it. -->
		<Button
			size="sm"
			disabled={busy}
			data-testid="source-retarget"
			onclick={() => resultInput.openRetarget(space, evidenceId)}>{t('result.retarget')}</Button
		>
	</div>
{/if}
