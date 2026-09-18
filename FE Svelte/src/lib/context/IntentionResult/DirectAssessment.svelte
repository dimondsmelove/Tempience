<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { assessDirectly } from '$lib/context/IntentionResult/actions';
	import { OUTCOME_KEYS } from '$lib/context/TraceEditor/results';
	import type { WriteOutcome } from '$lib/context/write';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { resultInput } from '$lib/state/ResultInput/ResultInput.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import type { IntentionOutcome } from '$lib/state/triplit/IntentionAssessments/types';
	import Button from '$lib/ui/Button/Button.svelte';

	let {
		intentionId,
		closed,
		read,
		oncancel,
		onwritten
	}: {
		intentionId: string;
		/** Whether the intention is closed now, which is what an explicit reopening answers. */
		closed: boolean;
		read: () => Promise<void>;
		/** The step ends without a statement; what was typed is dropped. */
		oncancel: () => void;
		onwritten: (outcome: WriteOutcome) => void;
	} = $props();
	// The space this input belongs to: the client is fixed for the app's lifetime, and
	// another space may legitimately hold a record with the very same id.
	const space = activeDataSpace.id;
	const input = $derived(resultInput.for(space, intentionId));
	const stated = $derived(resultInput.stated(space, intentionId));
	const busy = $derived(resultInput.busy);
	let failure = $state.raw<unknown>(null);
	const assess = async (): Promise<void> => {
		if (!stated || busy) return;
		failure = null;
		const outcome = await assessDirectly(tempienceRepository, space, intentionId, input, read);
		failure = outcome.refusal;
		onwritten(outcome);
	};
	const cancel = (): void => {
		resultInput.clear(space, intentionId);
		oncancel();
	};
</script>

<!-- A statement about the intention itself: an outcome, an openness, or both. Openness is
     stated on its own — an unchecked box says nothing, choosing an outcome closes nothing. -->
<div class="grid gap-2 rounded border border-outline p-2" data-testid="direct-assessment">
	<fieldset disabled={busy} class="grid gap-2 border-0 p-0">
		<select
			class="cg-control cg-field"
			aria-label={t('result.outcome')}
			data-testid="direct-outcome"
			value={input.outcome ?? ''}
			onchange={(event) =>
				resultInput.set(
					space,
					intentionId,
					'outcome',
					event.currentTarget.value === ''
						? undefined
						: (event.currentTarget.value as IntentionOutcome)
				)}
		>
			<option value="">{t('result.outcomeNone')}</option>
			{#each OUTCOME_KEYS as [value, key] (value)}
				<option {value}>{t(key)}</option>
			{/each}
		</select>
		{#if closed}
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					data-testid="direct-reopen"
					checked={input.open === true}
					onchange={(event) =>
						resultInput.set(
							space,
							intentionId,
							'open',
							event.currentTarget.checked ? true : undefined
						)}
				/>{t('result.reopen')}
			</label>
		{:else}
			<label class="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					data-testid="direct-close"
					checked={input.open === false}
					onchange={(event) =>
						resultInput.set(
							space,
							intentionId,
							'open',
							event.currentTarget.checked ? false : undefined
						)}
				/>{t('result.close')}
			</label>
		{/if}
	</fieldset>
	<div class="flex items-center gap-2">
		<Button
			size="sm"
			variant="primary"
			disabled={!stated || busy}
			data-testid="direct-save"
			onclick={() => void assess()}>{t('result.directSave')}</Button
		>
		<Button size="sm" variant="quiet" disabled={busy} data-testid="direct-discard" onclick={cancel}
			>{t('result.cancel')}</Button
		>
	</div>
	{#if failure}
		<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="direct-error"
			>{t('result.directFailed', { message: errorText(failure) })}</span
		>
	{/if}
</div>
