<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { Scope } from '$lib/state/triplit';
	import Button from '$lib/ui/Button/Button.svelte';
	import { lifeView, lifeViewState, updateLifeView } from './life-view.svelte';

	type Props = {
		scopes: Scope[];
		scopeWeekCount: number;
		visibleWeekCount: number;
	};

	let { scopes, scopeWeekCount, visibleWeekCount }: Props = $props();

	const scope = $derived(lifeViewState.scope);
	const scopeIncludeFuture = $derived(lifeView.scopeIncludeFuture);
	const scopePercent = $derived(
		visibleWeekCount > 0 ? Math.round((scopeWeekCount / visibleWeekCount) * 100) : 0
	);
	const scopeItems = $derived(
		scopes.filter((item) => !item.isDeleted).map((item) => ({ value: item.id, name: item.name }))
	);

	const applyScope = (value: string): void => {
		const next = value ? { id: value } : null;
		updateLifeView({ scope: next, scopeIncludeFuture: next ? scopeIncludeFuture : false });
	};
</script>

<div class="cg-panel flex flex-wrap items-end gap-3">
	<div class="min-w-0 flex-1 basis-64">
		<label for="life-scope-select" class="mb-1 block text-sm text-muted">Scope focus</label>
		<select
			id="life-scope-select"
			class="cg-control cg-field w-full text-sm"
			value={scope?.id ?? ''}
			onchange={(event) => applyScope(event.currentTarget.value)}
		>
			<option value="">{t('life.noScope')}</option>
			{#each scopeItems as item (item.value)}
				<option value={item.value}>{item.name}</option>
			{/each}
		</select>
	</div>

	{#if scope}
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				checked={scopeIncludeFuture}
				onchange={(event) => updateLifeView({ scopeIncludeFuture: event.currentTarget.checked })}
			/>
			{t('life.scopeFuture')}
		</label>
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm text-muted"
				>{t('life.scopeShare', { weeks: scopeWeekCount, percent: scopePercent })}</span
			>
			<Button size="sm" onclick={() => applyScope('')}>{t('life.reset')}</Button>
		</div>
	{/if}
</div>
