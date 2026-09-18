<script lang="ts">
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import TraceValues from '$lib/context/TraceValues/TraceValues.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { resultCandidates } from '$lib/state/TraceDraft/results';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { openKey, outcomeKey } from './results';

	let { draft, onclose }: { draft: TraceDraftState; onclose: () => void } = $props();
	const id = $props.id();
	const role = $derived(draft.targetContext.role);
	let query = $state('');
	let scopeId = $state('');
	let from = $state('');
	let to = $state('');
	let all = $state(false);
	/** Open intentions by default; every filter is optional and works without text. */
	const candidates = $derived(
		resultCandidates(draft.results.rows, {
			role,
			selfId: draft.entry.mode === 'edit' ? draft.entry.traceId : null,
			query,
			scopeId,
			from,
			to,
			all
		})
	);
	const scopeName = (scope: string): string =>
		draft.scopeList.find((entry) => entry.id === scope)?.name ?? t('draft.scopeUnavailable');
	/** Arrow keys walk the candidates; Enter and Space choose, as buttons do. */
	const walk = (event: KeyboardEvent & { currentTarget: HTMLButtonElement }): void => {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const list = event.currentTarget.closest('ul');
		if (!list) return;
		const buttons = [...list.querySelectorAll<HTMLButtonElement>('button')];
		const index = buttons.indexOf(event.currentTarget);
		if (index < 0) return;
		event.preventDefault();
		buttons[
			(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length
		]?.focus();
	};
</script>

<!-- A filter narrows what is offered, never what is chosen: a chosen record stays chosen
     whatever the list shows, and is removed only from its own row. -->
<div class="grid gap-2 rounded border border-outline p-2" data-testid="result-picker">
	<input
		class="cg-control cg-field"
		type="search"
		aria-label={t('result.search')}
		placeholder={t('result.search')}
		data-testid="result-search"
		bind:value={query}
	/>
	<div class="grid gap-2 sm:grid-cols-3">
		<label class="grid gap-1 text-xs text-muted"
			>{t('result.scopeFilter')}
			<select class="cg-control cg-field" data-testid="result-scope" bind:value={scopeId}>
				<option value="">{t('result.scopeAny')}</option>
				{#each draft.scopeList as scope (scope.id)}
					<option value={scope.id}>{scope.name}</option>
				{/each}
			</select>
		</label>
		<label class="grid gap-1 text-xs text-muted"
			>{t('result.from')}
			<input class="cg-control cg-field" type="date" data-testid="result-from" bind:value={from} />
		</label>
		<label class="grid gap-1 text-xs text-muted"
			>{t('result.to')}
			<input class="cg-control cg-field" type="date" data-testid="result-to" bind:value={to} />
		</label>
	</div>
	{#if role === 'intention'}
		<div class="flex gap-1" role="group" aria-label={t('result.for')}>
			<Button size="sm" pressed={!all} data-testid="result-open" onclick={() => (all = false)}
				>{t('result.open')}</Button
			>
			<Button size="sm" pressed={all} data-testid="result-all" onclick={() => (all = true)}
				>{t('result.all')}</Button
			>
		</div>
	{/if}
	{#if candidates.length}
		<ul class="grid max-h-72 gap-1 overflow-auto" aria-labelledby={`${id}-candidates`}>
			<li id={`${id}-candidates`} class="text-xs text-muted">{t('result.candidates')}</li>
			{#each candidates as candidate (candidate.trace.id)}
				{@const chosen = draft.results.has(candidate.trace.id)}
				<li>
					<button
						type="button"
						class={[
							'grid w-full cursor-pointer gap-0.5 rounded border px-2 py-1 text-left text-sm',
							chosen ? 'border-accent' : 'border-outline hover:border-accent'
						]}
						aria-pressed={chosen}
						aria-label={t(chosen ? 'result.unselect' : 'result.select', {
							title: candidate.summary.title ?? t('trace.unnamed')
						})}
						data-testid="result-candidate"
						onkeydown={walk}
						onclick={() =>
							chosen
								? draft.results.remove(candidate.trace.id)
								: draft.results.add(candidate.trace.id)}
					>
						<span class="break-words">{candidate.summary.title ?? t('trace.unnamed')}</span>
						<span class="font-mono text-xs text-muted"
							>{traceTimeLabel(candidate.trace, locale.current)}{#if candidate.scopeIds.length}
								· {candidate.scopeIds.map(scopeName).join(', ')}{/if}</span
						>
						<TraceValues summary={candidate.summary} />
						{#if candidate.state}
							<span class="text-xs text-muted" data-testid="candidate-state"
								>{t(outcomeKey(candidate.state.outcome))} · {t(openKey(candidate.state.open))}</span
							>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="text-sm text-muted" data-testid="result-empty">{t('result.empty')}</p>
	{/if}
	<div>
		<Button size="sm" variant="quiet" data-testid="result-picker-close" onclick={onclose}
			>{t('draft.close')}</Button
		>
	</div>
</div>
