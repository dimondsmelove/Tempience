<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { onMount } from 'svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { TraceKind } from '$lib/state/triplit/types';
	import { scopeCountsLabel } from '$lib/model/FilterCounts/FilterCounts';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import type { FilterListProps } from './types';

	let { filters, counts, scopes = [] }: FilterListProps = $props();
	let kinds = $state.raw<TraceKind[]>([]);
	let failure = $state.raw<unknown>(null);
	const hidden = $derived(scopes.filter((scope) => filters.hiddenScopes.has(scope.id)));
	onMount(() =>
		repository.subscribeTraceKinds(
			(rows) => {
				kinds = rows;
			},
			(cause) => {
				failure = cause ?? new Error();
			}
		)
	);
</script>

<!-- The «Фильтры» popover: Trace Kinds and hidden Scopes. The legend kinds are filtered on the
     ribbon itself, in the legend strip (research п. 17). Every item carries the number of records
     it is about, in the rail's mono figures (owner review 2026-09-19, п. 7; loop 008, C7): a Kind
     — its records in the space, whatever the window; a hidden Scope — the `n · Σ m` its row had. -->
{#if failure !== null}<p role="alert">{errorText(failure)}</p>{/if}
{#if kinds.length}
	<!-- Typed records are off the ribbon until a Kind is ticked here; the list stays folded
	     until asked for (owner, 2026-09-15). -->
	<details class="text-sm" data-testid="kind-filters">
		<summary class="cursor-pointer text-muted hover:text-ink"
			>{t('legend.kinds')}{#if filters.shownKindIds.size}
				<span class="font-mono text-xs"> · {filters.shownKindIds.size}</span>{/if}</summary
		>
		<div class="mt-2 grid gap-1">
			{#each kinds as kind (kind.id)}
				{@const count = counts.kinds.get(kind.id) ?? 0}
				<div class="flex min-h-7 items-center gap-2" data-testid="kind-filter">
					<label class="flex min-w-0 items-center gap-2">
						<input
							type="checkbox"
							checked={filters.shownKindIds.has(kind.id)}
							aria-describedby="kind-count-{kind.id}"
							onchange={() => filters.toggleKind(kind.id)}
						/>
						<span class="min-w-0 break-words">{kind.name}</span>
					</label>
					<span
						id="kind-count-{kind.id}"
						class="shrink-0 font-mono text-xs text-muted"
						title={t('filters.kindCount', { count })}
						data-testid="kind-count">· {count}</span
					>
				</div>
			{/each}
		</div>
	</details>
{/if}
{#if hidden.length}
	<!-- Scopes hidden from the rail with their eye are a filter like any other: named here as
	     chips in their colours, shown again one by one or all at once, and cleared with «Сбросить всё». -->
	<div
		class={['grid gap-1 text-sm', kinds.length && 'border-t border-outline pt-2']}
		data-testid="hidden-scopes"
	>
		<span class="text-xs text-muted" data-testid="hidden-scopes-count"
			>{t('rail.hidden', { count: hidden.length })}</span
		>
		<ul class="flex flex-wrap gap-1" aria-label={t('rail.hidden', { count: hidden.length })}>
			{#each hidden as scope (scope.id)}
				{@const count = counts.hiddenScopes.get(scope.id) ?? { direct: 0, subtree: 0 }}
				<li class="max-w-full min-w-0">
					<ScopeChip
						id={scope.id}
						name={scope.name}
						colorHue={scope.colorHue ?? null}
						colorChroma={scope.colorChroma ?? null}
						colorDepth={scope.colorDepth ?? null}
						openLabel={t('rail.showScope', { name: scope.name })}
						onopen={(id) => filters.showScope(id)}
					>
						<span
							class="px-1 font-mono text-xs whitespace-nowrap text-muted"
							title={t('rail.scopeCounts', count)}
							data-testid="hidden-scope-count">{scopeCountsLabel(count)}</span
						>
					</ScopeChip>
				</li>
			{/each}
		</ul>
		<Button size="sm" onclick={() => filters.showAllScopes()}>{t('rail.showAll')}</Button>
	</div>
{/if}
{#if !kinds.length && !hidden.length}
	<p class="text-sm text-muted" data-testid="filters-empty">{t('toolbar.filtersEmpty')}</p>
{/if}
