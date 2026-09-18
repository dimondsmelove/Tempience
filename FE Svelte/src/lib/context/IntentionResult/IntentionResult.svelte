<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { formatDay } from '$lib/context/labels';
	import { readContext } from '$lib/context/reload';
	import { outcomeKey } from '$lib/context/TraceEditor/results';
	import type { WriteOutcome } from '$lib/context/write';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import DirectAssessment from './DirectAssessment.svelte';
	import IntentionSource from './IntentionSource.svelte';

	let { workbench, records }: { workbench: WorkbenchState; records: RecordsReader } = $props();
	const result = $derived(records.result?.result ?? null);
	/** What a command of this part changed, kept until the next one whatever the reading did. */
	let notice = $state('');
	/** Why the views could not be read again; only the reading is offered again, never the write. */
	let readFailure = $state.raw<unknown>(null);
	/**
	 * The assessment form is a step the user opens; it closes after a committed write. Input
	 * typed there and not sent is kept beyond this view, so a rebuilt view opens the step again.
	 */
	let choice = $state<{ id: string; open: boolean } | null>(null);
	const assessing = $derived(
		choice && result && choice.id === result.intentionId
			? choice.open
			: Boolean(result && resultInput.stated(activeDataSpace.id, result.intentionId))
	);
	const setAssessing = (open: boolean): void => {
		if (result) choice = { id: result.intentionId, open };
	};
	/** Which statement decided the outcome (or, failing that, the openness): one line says so. */
	const decidedBy = $derived.by(() => {
		if (!result) return '';
		const id = result.outcomeSourceId ?? result.openSourceId;
		const source = id ? result.sources.find((entry) => entry.id === id) : undefined;
		if (!source) return t('result.byNothing');
		const who =
			source.kind === 'direct'
				? t('result.byDirectShort')
				: t('result.byFact', { title: source.factSummary?.title ?? t('trace.unnamed') });
		const when = source.firstAssessedAt
			? formatDay(new Date(source.firstAssessedAt).getTime())
			: '';
		return when ? `${who} · ${when}` : who;
	});
	const read = (): Promise<void> => readContext(workbench, records, loadWorkbenchSnapshot);
	/** A command of this part: what it committed is said here, and only its reading is retried. */
	const committed = (outcome: WriteOutcome, done: string): void => {
		if (!outcome.written) return;
		notice = done;
		readFailure = outcome.readFailure;
		setAssessing(false);
	};
	const retry = async (): Promise<void> => {
		try {
			await read();
			readFailure = null;
		} catch (cause) {
			readFailure = cause ?? new Error();
		}
	};
	/** The reading of this part failed on its own, without a command of ours. */
	const failure = $derived(readFailure !== null ? errorText(readFailure) : records.error);
</script>

<!-- What the intention's result is now (core/intersections «производный итог»), in one line,
     with what decided it; one action opens the assessment; every statement ever addressed to
     the intention waits folded under «История оценок» (owner, 2026-09-15). -->
<section class="flex flex-col gap-3" data-testid="intention-result">
	{#if notice}
		<p class="text-sm" role="status" data-testid="result-notice">{notice}</p>
	{/if}
	{#if failure}
		<p class="text-sm text-[color:var(--cg-danger)]" role="alert" data-testid="result-read-error">
			{t('link.readFailed', { message: failure })}
			<Button size="sm" variant="quiet" data-testid="result-retry" onclick={() => void retry()}
				>{t('kind.retryLoad')}</Button
			>
		</p>
	{/if}
	{#if result}
		<div class="flex flex-wrap items-baseline gap-x-2 gap-y-1">
			<p class="text-base font-semibold" data-testid="result-state">
				<span data-testid="result-open" data-open={result.open ? 'open' : 'closed'}
					>{t(result.open ? 'result.stateOpen' : 'result.stateClosed')}</span
				>
				·
				<span data-testid="result-outcome" data-outcome={result.outcome ?? 'unassessed'}
					>{t(outcomeKey(result.outcome))}</span
				>
			</p>
			<span class="text-xs text-muted" data-testid="result-decided">{decidedBy}</span>
		</div>
		{#if assessing}
			<DirectAssessment
				intentionId={result.intentionId}
				closed={!result.open}
				{read}
				oncancel={() => setAssessing(false)}
				onwritten={(outcome) => committed(outcome, t('result.directDone'))}
			/>
		{:else}
			<div>
				<Button size="sm" data-testid="result-assess" onclick={() => setAssessing(true)}
					>{t(result.sources.length ? 'result.reassess' : 'result.assess')}</Button
				>
			</div>
		{/if}
		{#if result.sources.length}
			<details data-testid="result-sources">
				<summary class="cursor-pointer text-sm text-muted hover:text-ink"
					>{t('result.history')} · {result.sources.length}</summary
				>
				<ul class="mt-2 flex flex-col gap-1" data-testid="result-source-list">
					{#each result.sources as source (source.id)}
						<li>
							<IntentionSource
								{source}
								decides={[source.id === result.outcomeSourceId, source.id === result.openSourceId]}
								{workbench}
								{records}
								{read}
								onwritten={(outcome) => committed(outcome, t('result.retargetDone'))}
							/>
						</li>
					{/each}
				</ul>
			</details>
		{/if}
	{:else if records.loading}
		<p class="text-sm text-muted" data-testid="result-loading">{t('result.loading')}</p>
	{:else if !failure}
		<p class="text-sm text-muted" data-testid="result-loading">{t('result.loading')}</p>
	{/if}
</section>
