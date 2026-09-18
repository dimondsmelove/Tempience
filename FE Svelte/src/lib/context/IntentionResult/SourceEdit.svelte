<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { offerUndo } from '$lib/context/undo';
	import { OUTCOME_KEYS } from '$lib/context/TraceEditor/results';
	import { writeThenRead, type WriteOutcome } from '$lib/context/write';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { IntentionSourceView } from '$lib/state/Records/result';
	import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	import type { UndoState } from '$lib/state/Undo/Undo.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let {
		source,
		undo,
		read,
		onwritten
	}: {
		source: IntentionSourceView;
		undo: UndoState;
		read: () => Promise<void>;
		onwritten: (outcome: WriteOutcome) => void;
	} = $props();
	const space = activeDataSpace.id;
	/** The correction being prepared for this statement, held where every other input is. */
	const input = $derived(resultInput.for(space, source.id));
	const stated = $derived(Object.hasOwn(input, 'outcome') || Object.hasOwn(input, 'open'));
	const busy = $derived(resultInput.busy);
	const withdrawn = $derived(source.reason === 'deleted');
	let failure = $state.raw<unknown>(null);
	const outcomeValue = $derived(Object.hasOwn(input, 'outcome') ? (input.outcome ?? 'clear') : '');
	/**
	 * One command of this statement. An action that can be taken back is offered back; bringing
	 * a statement back is not one of them — it is recorded with its own cause, which the inverse
	 * deliberately refuses to redo, and an offer that cannot be honoured is worse than none.
	 */
	const act = async (
		label: string,
		write: () => Promise<{ operationId: string | null | undefined }>,
		offered = true,
		committed?: () => void
	): Promise<void> => {
		if (busy) return;
		failure = null;
		const outcome = await resultInput.hold(
			offered
				? offerUndo({
						undo,
						space,
						repository: tempienceRepository,
						label,
						write,
						committed,
						read
					})
				: writeThenRead(
						async () => {
							await write();
						},
						read,
						committed
					)
		);
		failure = outcome.refusal;
		onwritten(outcome);
	};
	/**
	 * A correction of this statement's own features: the statement keeps its identity and its
	 * first time, an untouched feature is not sent, and clearing one is not the same as saying
	 * the opposite of it. Nothing of the current result is resubmitted.
	 */
	const correct = () => {
		// The statement and what is said about it are taken at the command, with the space this
		// input belongs to: what is sent cannot change under the command, and the correction is
		// released only once the repository has taken it — a refusal leaves it as it was typed.
		const sourceId = source.id;
		const values = input;
		return act(
			t('source.corrected'),
			async () => {
				// The correction's own operation — not the row's lifecycle stamp, which a
				// correction never touches — and none when the statement already said this.
				const { operation } = await tempienceRepository.editIntentionAssessment(
					sourceId,
					values,
					'user'
				);
				return { operationId: operation?.id ?? null };
			},
			true,
			() => resultInput.clear(space, sourceId)
		);
	};
	const setDeleted = (deleted: boolean) =>
		act(
			t(deleted ? 'source.withdrawn' : 'source.restored'),
			async () => {
				const { operation } = await tempienceRepository.setIntentionAssessmentDeleted(
					source.id,
					deleted,
					'user'
				);
				return { operationId: operation?.id ?? null };
			},
			deleted
		);
</script>

<!-- What can still be done with a statement that already stands: correct what it says,
     withdraw it, or bring back one that was withdrawn. Making a new statement is a different
     action and stays where it is. -->
<div class="grid gap-2" data-testid="source-edit" data-withdrawn={withdrawn ? 'true' : undefined}>
	{#if withdrawn}
		<div>
			<Button
				size="sm"
				disabled={busy}
				data-testid="source-restore"
				onclick={() => setDeleted(false)}>{t('source.restore')}</Button
			>
		</div>
	{:else}
		<fieldset disabled={busy} class="grid gap-2 border-0 p-0">
			<label class="grid gap-1 text-sm"
				>{t('source.correct')}
				<select
					class="cg-control cg-field"
					data-testid="source-outcome"
					value={outcomeValue}
					onchange={(event) =>
						resultInput.set(
							space,
							source.id,
							'outcome',
							event.currentTarget.value === ''
								? undefined
								: event.currentTarget.value === 'clear'
									? null
									: (event.currentTarget.value as IntentionOutcome)
						)}
				>
					<option value="">{t('result.outcomeKeep')}</option>
					{#each OUTCOME_KEYS as [value, key] (value)}
						<option {value}>{t(key)}</option>
					{/each}
					{#if source.outcome !== null}
						<option value="clear">{t('result.outcomeClear')}</option>
					{/if}
				</select>
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					data-testid="source-close"
					checked={input.open === false}
					onchange={(event) =>
						resultInput.set(
							space,
							source.id,
							'open',
							event.currentTarget.checked ? false : undefined
						)}
				/>{t('result.close')}
			</label>
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					data-testid="source-reopen"
					checked={input.open === true}
					onchange={(event) =>
						resultInput.set(
							space,
							source.id,
							'open',
							event.currentTarget.checked ? true : undefined
						)}
				/>{t('result.reopen')}
			</label>
			{#if source.open !== null}
				<Button
					size="sm"
					variant="quiet"
					class="justify-self-start"
					pressed={input.open === null}
					data-testid="source-open-clear"
					onclick={() =>
						resultInput.set(space, source.id, 'open', input.open === null ? undefined : null)}
					>{t('result.openClear')}</Button
				>
			{/if}
		</fieldset>
		<div class="flex flex-wrap items-center gap-2">
			<Button
				size="sm"
				disabled={!stated || busy}
				data-testid="source-correct"
				onclick={() => void correct()}>{t('source.save')}</Button
			>
			<Button
				size="sm"
				variant="quiet"
				disabled={busy}
				data-testid="source-withdraw"
				onclick={() => void setDeleted(true)}>{t('source.withdraw')}</Button
			>
		</div>
	{/if}
	{#if failure}
		<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="source-error"
			>{errorText(failure)}</span
		>
	{/if}
</div>
