<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { MAX_WEEKLY_MINUTES } from '$lib/state/triplit/PracticeTargets/targets';
	import { dateLabel } from '../PracticeDemo/format';
	import type { PracticeChartActivity } from '../PracticeDemo/types';

	let {
		activities,
		week,
		onsave
	}: {
		/** Tracked activities with the budget of the current week in `weeklyMinutes`. */
		activities: readonly PracticeChartActivity[];
		/** Monday of the current week: where a saved budget starts. */
		week: string;
		onsave: (scopeId: string, minutes: number | null) => Promise<void>;
	} = $props();
	const drafts = new SvelteMap<string, string>();
	let busy = $state<string | null>(null);
	let failure = $state<unknown>(null);
	let saved = $state<string | null>(null);

	const valueOf = (item: PracticeChartActivity): string =>
		drafts.get(item.id) ?? (item.weeklyMinutes === null ? '' : String(item.weeklyMinutes));
	const parsed = (value: string): number | null | undefined => {
		if (value.trim() === '') return null;
		const minutes = Number(value);
		return Number.isInteger(minutes) && minutes > 0 && minutes <= MAX_WEEKLY_MINUTES
			? minutes
			: undefined;
	};
	const save = async (item: PracticeChartActivity, minutes: number | null): Promise<void> => {
		busy = item.id;
		failure = null;
		saved = null;
		try {
			await onsave(item.id, minutes);
			drafts.delete(item.id);
			saved = item.id;
		} catch (cause) {
			failure = cause;
		} finally {
			busy = null;
		}
	};
</script>

<section
	class="practice-panel"
	aria-labelledby="practice-budgets-title"
	data-testid="practice-budgets"
>
	<h2 id="practice-budgets-title">{t('practice.budgets')}</h2>
	<p>{t('practice.budgetsHelp')}</p>
	<ul class="practice-budget-list">
		{#each activities as item (item.id)}
			{@const value = valueOf(item)}
			{@const minutes = parsed(value)}
			<li class="practice-budget">
				<span class="practice-budget-name"
					><i
						class={['practice-swatch', !item.color && 'practice-swatch-uncoloured']}
						style:--activity-color={item.color ?? 'var(--cg-text-muted)'}
						aria-hidden="true"
					></i>{item.name}</span
				>
				<input
					type="number"
					inputmode="numeric"
					min="1"
					max={MAX_WEEKLY_MINUTES}
					step="1"
					class="cg-control cg-field"
					placeholder={t('practice.noGoal')}
					aria-label={t('practice.budgetFor', { name: item.name })}
					aria-invalid={minutes === undefined ? 'true' : undefined}
					{value}
					oninput={(event) => drafts.set(item.id, event.currentTarget.value)}
				/>
				<button
					type="button"
					class="cg-control"
					disabled={busy !== null || minutes === undefined || minutes === item.weeklyMinutes}
					aria-label={`${t('practice.budgetSave')}: ${item.name}`}
					onclick={() => save(item, minutes ?? null)}>{t('practice.budgetSaveShort')}</button
				>
				{#if item.weeklyMinutes !== null}<button
						type="button"
						class="cg-control"
						disabled={busy !== null}
						aria-label={`${t('practice.budgetClear')}: ${item.name}`}
						onclick={() => save(item, null)}>{t('practice.budgetClearShort')}</button
					>{/if}
			</li>
		{/each}
	</ul>
	{#if saved}<p role="status">
			{t('practice.budgetSaved', { week: dateLabel(week, locale.current) })}
		</p>{/if}
	{#if failure}<p role="alert">{errorText(failure)}</p>{/if}
</section>
