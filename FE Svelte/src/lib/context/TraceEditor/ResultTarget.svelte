<script lang="ts">
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import TraceValues from '$lib/context/TraceValues/TraceValues.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import {
		blocksStatement,
		hasInput,
		targetRefusal,
		targetState
	} from '$lib/state/TraceDraft/targets';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import type { ResultTarget } from '$lib/state/TraceDraft/types';
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import { getLens, lensSource } from '$lib/ui/LensSource';
	import { OUTCOME_KEYS, STATE_KEYS, openKey, outcomeControlValue, outcomeKey } from './results';

	let { draft, target }: { draft: TraceDraftState; target: ResultTarget } = $props();
	const id = $props.id();
	/** Under the workbench the chosen record lights on the ribbon (loop 008, C3). */
	const hover = getLens();
	const role = $derived(draft.targetContext.role);
	const row = $derived(draft.results.rowOf(target.otherId));
	/** A record with nothing readable to name it says so rather than showing a blank line. */
	const title = $derived(row?.summary.title ?? t('trace.unnamed'));
	/** The intention the statement is about: the target itself, or the edited intention. */
	const intention = $derived(
		role === 'intention'
			? row
			: draft.entry.mode === 'edit'
				? draft.results.rowOf(draft.entry.traceId)
				: null
	);
	/** What the intention's outcome and openness are now, derived from every eligible source. */
	const current = $derived(intention?.state ?? null);
	/** What is true of this target, said from the start; a refusal is what this save cannot write. */
	const state = $derived(targetState(target, draft.targetContext));
	const refusal = $derived(targetRefusal(target, draft.targetContext));
	/** No statement can be made through such a target, so its controls invite none. */
	const locked = $derived(blocksStatement(state));
	const pending = $derived(hasInput(target));
	/** The saved link this target stands for, with its own source as the binding rules read it. */
	const saved = $derived(
		draft.evidenceRoles.find((entry) => entry.linkId === target.linkId) ?? null
	);
	const own = $derived(saved?.source === 'current' ? saved.own : null);
	const outcomeValue = $derived(outcomeControlValue(target.input));
	const chooseOutcome = (value: string): void => {
		draft.results.setOutcome(
			target.otherId,
			value === '' ? undefined : value === 'clear' ? null : (value as IntentionOutcome)
		);
	};
</script>

<!-- One chosen record with the statement made for it (TRACE_FORMS «оценка намерения»): the
     current state is shown apart from the own input; untouched controls state nothing. -->
<div
	class="grid gap-2 rounded border border-outline p-2"
	data-testid="result-target"
	data-target={target.otherId}
	data-link={target.linkId ?? undefined}
	{@attach lensSource(hover, { kind: 'trace', traceId: target.otherId })}
>
	<div class="flex items-start gap-2">
		<div class="min-w-0 flex-1">
			<p class="text-sm font-medium break-words">{title}</p>
			{#if row}
				<p class="font-mono text-xs text-muted">
					{traceTimeLabel(row.trace, locale.current)}{#if role === 'fact' && !row.dated}
						· {t('result.undated')}{/if}
				</p>
				<TraceValues summary={row.summary} />
			{/if}
			{#if current}
				<p class="text-xs text-muted" data-testid="target-state">
					{t('result.now', {
						outcome: t(outcomeKey(current.outcome)),
						open: t(openKey(current.open))
					})}
				</p>
			{/if}
			{#if saved}
				<p class="text-xs text-muted" data-testid="target-own">
					{own
						? t('result.own', {
								outcome: t(outcomeKey(own.outcome)),
								open: own.open === null ? '—' : t(openKey(own.open))
							})
						: saved.source === 'withdrawn'
							? t('result.ownWithdrawn')
							: t('result.ownNone')}
				</p>
			{/if}
			{#if state}
				<!-- Said whether or not it blocks: a reference that outlived its record keeps its
				     history, and only a delta this save would write is an error. -->
				<p
					class={['text-xs', refusal ? 'text-[color:var(--cg-danger)]' : 'text-muted']}
					role={refusal ? 'alert' : undefined}
					data-testid="target-problem"
					data-blocking={refusal ? 'true' : undefined}
				>
					{t(STATE_KEYS[state])}
				</p>
			{/if}
		</div>
		<Button
			size="sm"
			variant="quiet"
			icon
			aria-label={t('result.unselect', { title })}
			data-testid="target-remove"
			onclick={() => draft.results.remove(target.otherId)}><span aria-hidden="true">×</span></Button
		>
	</div>
	<fieldset disabled={locked} class="grid gap-2 border-0 p-0">
		<label class="grid gap-1 text-sm" for={`${id}-outcome`}>{t('result.outcome')}</label>
		<select
			id={`${id}-outcome`}
			class="cg-control cg-field"
			data-testid="target-outcome"
			value={outcomeValue}
			onchange={(event) => chooseOutcome(event.currentTarget.value)}
		>
			<option value="">{t('result.outcomeKeep')}</option>
			{#each OUTCOME_KEYS as [value, key] (value)}
				<option {value}>{t(key)}</option>
			{/each}
			{#if own?.outcome}
				<option value="clear">{t('result.outcomeClear')}</option>
			{/if}
		</select>
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				data-testid="target-close"
				checked={target.input.open === false}
				onchange={(event) =>
					draft.results.setOpen(target.otherId, event.currentTarget.checked ? false : undefined)}
			/>{t('result.close')}
		</label>
		{#if current?.open === false}
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					data-testid="target-reopen"
					checked={target.input.open === true}
					onchange={(event) =>
						draft.results.setOpen(target.otherId, event.currentTarget.checked ? true : undefined)}
				/>{t('result.reopen')}
			</label>
		{/if}
		{#if own && own.open !== null}
			<!-- The own openness is withdrawn on its own, like the own outcome: the source, its
			     outcome and the link stay, and the intention goes back to being open by default. -->
			<Button
				size="sm"
				variant="quiet"
				class="justify-self-start"
				pressed={target.input.open === null}
				data-testid="target-open-clear"
				onclick={() =>
					draft.results.setOpen(target.otherId, target.input.open === null ? undefined : null)}
				>{t('result.openClear')}</Button
			>
		{/if}
	</fieldset>
	{#if locked && pending}
		<!-- Outside the locked controls: the statement started here can always be taken back
		     without touching the reference or anything else in the form. -->
		<Button
			size="sm"
			class="justify-self-start"
			data-testid="target-cancel-edit"
			onclick={() => draft.results.clearInput(target.otherId)}>{t('result.cancelEdit')}</Button
		>
	{/if}
</div>
