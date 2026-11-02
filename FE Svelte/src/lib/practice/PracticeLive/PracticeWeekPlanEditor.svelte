<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { scopeRows } from '$lib/ui/ScopePicker/tree';
	import type { ScopeOption } from '$lib/ui/ScopePicker/types';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { MAX_WEEKLY_MINUTES } from '$lib/state/triplit/PracticeTargets/targets';
	import { dateLabel } from '../../model/Practice/format';
	import type { PracticeChartActivity } from '../../model/Practice/types';
	import type { PracticeWeekPlan } from '$lib/state/triplit/PracticeWeeks/types';

	let {
		activities,
		scopes,
		week,
		plan,
		ondirty,
		onsave
	}: {
		activities: readonly PracticeChartActivity[];
		scopes: readonly ScopeOption[];
		week: string;
		plan: PracticeWeekPlan | null;
		ondirty: (dirty: boolean) => void;
		onsave: (
			week: string,
			scopeIds: readonly string[],
			goals: Readonly<Record<string, number>>
		) => Promise<void>;
	} = $props();
	const collapsed = new SvelteSet(
		untrack(() =>
			scopeRows(scopes)
				.filter((row) => row.hasChildren)
				.map((row) => row.id)
		)
	);
	const rows = $derived(scopeRows(scopes, '', collapsed));
	onDestroy(() => ondirty(false));
	const selected = new SvelteMap<string, boolean>();
	const drafts = new SvelteMap<string, string>();
	let busy = $state(false);
	let failure = $state<unknown>(null);
	let saved = $state(false);
	const retainedIds = $derived(
		(plan?.scopeIds ?? []).filter((id) => !activities.some((item) => item.id === id))
	);
	const checked = (id: string): boolean => selected.get(id) ?? !!plan?.scopeIds.includes(id);
	const valueOf = (item: PracticeChartActivity): string =>
		drafts.get(item.id) ?? (plan?.goals[item.id] == null ? '' : String(plan.goals[item.id]));
	const parsed = (value: string): number | null | undefined => {
		if (value.trim() === '') return null;
		const valueNumber = Number(value);
		return Number.isInteger(valueNumber) && valueNumber > 0 && valueNumber <= MAX_WEEKLY_MINUTES
			? valueNumber
			: undefined;
	};
	const save = async (): Promise<void> => {
		const retainedIds = (plan?.scopeIds ?? []).filter(
			(id) => !activities.some((item) => item.id === id)
		);
		const scopeIds = [
			...retainedIds,
			...activities.filter((item) => checked(item.id)).map((item) => item.id)
		];
		const goals: Record<string, number> = Object.fromEntries(
			retainedIds.flatMap((id) => (plan?.goals[id] == null ? [] : [[id, plan.goals[id]]]))
		);
		for (const item of activities.filter((activity) => checked(activity.id))) {
			const value = parsed(valueOf(item));
			if (value === undefined) return;
			if (value !== null) goals[item.id] = value;
		}
		busy = true;
		failure = null;
		saved = false;
		try {
			await onsave(week, scopeIds, goals);
			ondirty(false);
			selected.clear();
			drafts.clear();
			saved = true;
		} catch (cause) {
			failure = cause;
		} finally {
			busy = false;
		}
	};
</script>

<section
	class="practice-panel"
	aria-labelledby="practice-week-plan-title"
	data-testid="practice-week-plan"
>
	<h2 id="practice-week-plan-title">{t('practice.weekPlan')}</h2>
	<p>{t('practice.weekPlanHelp', { week: dateLabel(week, locale.current) })}</p>
	{#if retainedIds.length}<p role="note">
			{t('practice.retainedScopes', { ids: retainedIds.join(', ') })}
		</p>{/if}
	<ul class="practice-budget-list">
		{#each rows as row (row.id)}
			{@const item = activities.find((activity) => activity.id === row.id)!}
			{@const value = valueOf(item)}
			{@const minutes = parsed(value)}
			<li class="practice-budget" style:--scope-depth={row.depth}>
				<div class="practice-budget-activity">
					{#if row.hasChildren}
						<button
							type="button"
							class="practice-tree-toggle"
							aria-label={`${collapsed.has(row.id) ? t('practice.expandScope') : t('practice.collapseScope')}: ${row.name}`}
							aria-expanded={!collapsed.has(row.id)}
							onclick={() =>
								collapsed.has(row.id) ? collapsed.delete(row.id) : collapsed.add(row.id)}
							>{collapsed.has(row.id) ? '▸' : '▾'}</button
						>
					{:else}<span class="practice-tree-spacer" aria-hidden="true"></span>{/if}
					<label
						><input
							type="checkbox"
							checked={checked(item.id)}
							disabled={busy}
							onchange={(event) => {
								ondirty(true);
								selected.set(item.id, event.currentTarget.checked);
							}}
						/>{item.name}</label
					>
				</div>
				{#if checked(item.id)}
					<input
						type="number"
						inputmode="numeric"
						min="1"
						max={MAX_WEEKLY_MINUTES}
						step="1"
						class="cg-control cg-field"
						placeholder={t('practice.optionalGoal')}
						aria-label={t('practice.goalFor', { name: item.name })}
						aria-invalid={minutes === undefined ? 'true' : undefined}
						{value}
						oninput={(event) => {
							ondirty(true);
							drafts.set(item.id, event.currentTarget.value);
						}}
					/>
				{/if}
			</li>
		{/each}
	</ul>
	<button
		type="button"
		class="cg-control practice-plan-save"
		disabled={busy ||
			activities.some((item) => checked(item.id) && parsed(valueOf(item)) === undefined)}
		onclick={save}>{t('practice.saveWeekPlan')}</button
	>
	{#if !plan}<p role="note">{t('practice.emptyWeekPlan')}</p>{/if}
	{#if saved}<p role="status">{t('practice.weekPlanSaved')}</p>{/if}
	{#if failure}<p role="alert">{errorText(failure)}</p>{/if}
</section>
