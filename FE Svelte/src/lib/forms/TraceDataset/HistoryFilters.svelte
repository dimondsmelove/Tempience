<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { MessageKey } from '$lib/state/Locale/types';
	import type { KindHistoryState } from '$lib/state/KindHistory/KindHistory.svelte';
	import type { Scope, TraceKindV } from '$lib/state/triplit/types';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { ScopePicker, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import { composeFilter, describeFilter, filterOperators } from './model';
	import type { FilterField } from './types';
	let {
		history,
		versions,
		scopes,
		fields
	}: {
		history: KindHistoryState;
		versions: readonly TraceKindV[];
		scopes: readonly Scope[];
		fields: readonly FilterField[];
	} = $props();
	const OPERATORS: Record<string, MessageKey> = {
		'=': 'kindHistory.op.eq',
		'!=': 'kindHistory.op.ne',
		'>': 'kindHistory.op.gt',
		'>=': 'kindHistory.op.ge',
		'<': 'kindHistory.op.lt',
		'<=': 'kindHistory.op.le',
		like: 'kindHistory.op.like'
	};
	const filters = $derived(history.filters);
	const scopeOptions = $derived(scopeOptionsOf(scopes, workbench.view.intersections));
	/** Whether the user unfolded the filters; a filter that applies unfolds them anyway. */
	let opened = $state(false);
	const byGeneration = $derived(versions.toSorted((a, b) => b.generation - a.generation));
	/** Nested Scopes count with the chosen one unless the user says otherwise. */
	const subtree = $derived(filters.scope ? filters.scope.mode === 'subtree' : true);
	/**
	 * The condition being composed; it applies when added, never while typed. A changed field
	 * starts it over: a value typed for one field is never read as another field's.
	 */
	let fieldKey = $state('');
	let chosenOperator = $state('');
	let value = $state('');
	const field = $derived(fields.find((entry) => entry.key === fieldKey) ?? fields[0]);
	const operators = $derived(filterOperators(field));
	const operator = $derived(operators.find((entry) => entry === chosenOperator) ?? operators[0]);
	/** The composed condition as a filter, or null while the control shows none. */
	const composed = $derived(composeFilter(field, operator, value));
	const chooseField = (key: string) => {
		fieldKey = key;
		chosenOperator = '';
		value = '';
	};
	const toggleVersion = (versionId: string, checked: boolean) => {
		const shown = filters.versionIds ?? versions.map((version) => version.id);
		const next = checked
			? [...new Set([...shown, versionId])]
			: shown.filter((entry) => entry !== versionId);
		history.setFilters({ versionIds: next.length === versions.length ? null : next });
	};
	const setScope = (scopeId: string, nested = subtree) =>
		history.setFilters({
			scope: scopeId ? { id: scopeId, mode: nested ? 'subtree' : 'direct' } : null
		});
	const add = () => {
		if (!composed) return;
		history.setFilters({ values: [...filters.values, composed] });
		value = '';
	};
	const remove = (index: number) =>
		history.setFilters({ values: filters.values.filter((_, at) => at !== index) });
	const scopeName = (scopeId: string) =>
		scopes.find((scope) => scope.id === scopeId)?.name ?? scopeId;
	const generationOf = (versionId: string) =>
		versions.find((version) => version.id === versionId)?.generation ?? '?';
</script>

<!-- Open while a filter applies (the active ones stay visible), else as the user left it. -->
<details
	class="cg-panel grid gap-3 text-sm"
	data-testid="history-filters"
	open={opened || history.activeFilters > 0}
	ontoggle={(event) => {
		opened = event.currentTarget.open;
		if (!opened && history.activeFilters > 0) event.currentTarget.open = true;
	}}
>
	<summary class="cursor-pointer font-medium">
		{t('kindHistory.filters')}{#if history.activeFilters}<span
				class="ml-2 rounded-[var(--cg-radius-control)] bg-[var(--cg-accent-secondary)] px-1 font-mono text-xs text-[color:var(--cg-text-on-secondary)]"
				data-testid="history-filters-count">{history.activeFilters}</span
			>{/if}
	</summary>
	<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<fieldset class="grid gap-1">
			<legend class="text-xs text-muted">{t('kindHistory.versions')}</legend>
			{#each byGeneration as version (version.id)}
				<label class="flex items-center gap-2"
					><input
						type="checkbox"
						checked={filters.versionIds === null || filters.versionIds.includes(version.id)}
						onchange={(event) => toggleVersion(version.id, event.currentTarget.checked)}
					/>{t('kindHistory.versionLabel', { generation: version.generation })}</label
				>
			{/each}
		</fieldset>
		<div class="grid content-start gap-2">
			<div class="grid gap-1">
				<span class="text-xs text-muted">{t('kindHistory.scope')}</span>
				<ScopePicker
					scopes={scopeOptions}
					value={filters.scope?.id ?? null}
					none={t('kindHistory.scopeAny')}
					label="Scope"
					onpick={(id) => setScope(id ?? '')}
				/>
			</div>
			{#if filters.scope}<label class="flex items-center gap-2"
					><input
						type="checkbox"
						checked={subtree}
						onchange={(event) => setScope(filters.scope?.id ?? '', event.currentTarget.checked)}
					/>{t('kindHistory.scopeSubtree')}</label
				>{/if}
		</div>
		<label class="grid content-start gap-1"
			><span class="text-xs text-muted">{t('kindHistory.from')}</span><input
				class="cg-control cg-field"
				type="date"
				data-testid="history-from"
				value={filters.from}
				onchange={(event) => history.setFilters({ from: event.currentTarget.value })}
			/></label
		>
		<label class="grid content-start gap-1"
			><span class="text-xs text-muted">{t('kindHistory.to')}</span><input
				class="cg-control cg-field"
				type="date"
				data-testid="history-to"
				value={filters.to}
				onchange={(event) => history.setFilters({ to: event.currentTarget.value })}
			/></label
		>
	</div>
	{#if fields.length}
		<fieldset class="grid gap-2">
			<legend class="text-xs text-muted">{t('kindHistory.values')}</legend>
			<div class="flex flex-wrap items-end gap-2">
				<label class="grid gap-1"
					><span class="text-xs text-muted">{t('kindHistory.field')}</span><select
						class="cg-control cg-field"
						value={field?.key ?? ''}
						onchange={(event) => chooseField(event.currentTarget.value)}
						>{#each fields as entry (entry.key)}<option value={entry.key}>{entry.label}</option
							>{/each}</select
					></label
				>
				<label class="grid gap-1"
					><span class="text-xs text-muted">{t('kindHistory.operator')}</span><select
						class="cg-control cg-field"
						value={operator}
						onchange={(event) => (chosenOperator = event.currentTarget.value)}
						>{#each operators as op (op)}<option value={op}>{t(OPERATORS[op])}</option
							>{/each}</select
					></label
				>
				<label class="grid gap-1"
					><span class="text-xs text-muted">{t('kindHistory.value')}</span>
					{#if field?.type === 'boolean'}
						<!-- Nothing chosen is shown as nothing: a yes/no is a choice made, never taken. -->
						<select
							class="cg-control cg-field"
							data-testid="history-value"
							{value}
							onchange={(event) => (value = event.currentTarget.value)}
							><option value="">—</option><option value="true">{t('kindHistory.yes')}</option
							><option value="false">{t('kindHistory.no')}</option></select
						>
					{:else if field?.choices}
						<select
							class="cg-control cg-field"
							data-testid="history-value"
							{value}
							onchange={(event) => (value = event.currentTarget.value)}
							><option value="">—</option
							>{#each Object.entries(field.choices) as [key, label] (key)}<option value={key}
									>{label}</option
								>{/each}</select
						>
					{:else}
						<!-- The value is kept as typed: a number input bound as a number cannot be read as text. -->
						<input
							class="cg-control cg-field"
							type={field?.type === 'number' ? 'number' : 'text'}
							inputmode={field?.type === 'number' ? 'decimal' : undefined}
							step="any"
							data-testid="history-value"
							{value}
							oninput={(event) => (value = event.currentTarget.value)}
							onkeydown={(event) => {
								if (event.key === 'Enter') {
									event.preventDefault();
									add();
								}
							}}
						/>
					{/if}
				</label>
				<Button size="sm" disabled={!composed} onclick={add}>{t('kindHistory.addFilter')}</Button>
			</div>
		</fieldset>
	{/if}
	<div class="flex flex-wrap items-center gap-2" data-testid="history-active">
		<span class="text-xs text-muted">{t('kindHistory.active')}:</span>
		{#if history.activeFilters === 0}<span class="text-muted">{t('kindHistory.noFilters')}</span
			>{/if}
		{#if filters.versionIds}<span class="rounded border border-outline px-2 py-0.5"
				>{t('kindHistory.versions')}: {filters.versionIds.map(generationOf).join(', ')}</span
			>{/if}
		{#if filters.scope}<span class="rounded border border-outline px-2 py-0.5"
				>{t('kindHistory.scope')}: {scopeName(filters.scope.id)}{filters.scope.mode === 'subtree'
					? ' +'
					: ''}</span
			>{/if}
		{#if filters.from || filters.to}<span class="rounded border border-outline px-2 py-0.5"
				>{filters.from || '…'} — {filters.to || '…'}</span
			>{/if}
		{#each filters.values as filter, index (index)}
			{@const text = describeFilter(filter, fields, {
				yes: t('kindHistory.yes'),
				no: t('kindHistory.no')
			})}
			<span class="flex items-center gap-1 rounded border border-outline px-2 py-0.5"
				>{text}<button
					type="button"
					class="cursor-pointer text-muted hover:text-ink"
					aria-label={t('kindHistory.removeFilter', { filter: text })}
					onclick={() => remove(index)}>×</button
				></span
			>
		{/each}
		{#if history.activeFilters}<Button size="sm" variant="quiet" onclick={() => history.reset()}
				>{t('kindHistory.reset')}</Button
			>{/if}
	</div>
</details>
