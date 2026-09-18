<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { onMount } from 'svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { TraceKind } from '$lib/state/triplit/types';
	import { LEGEND_KEYS, LEGEND_KEY_LABELS } from '$lib/model/Projection/constants';
	import { UNAVAILABLE_LEGEND } from './constants';
	import type { LegendProps } from './types';

	let { filters }: LegendProps = $props();
	let kinds = $state.raw<TraceKind[]>([]);
	let failure = $state.raw<unknown>(null);
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

<div
	class="grid grid-cols-2 items-center gap-1 text-xs text-muted"
	role="group"
	aria-label={t('legend.show')}
	data-testid="legend"
>
	<span class="col-span-2 mb-1">{t('legend.show')}</span>
	{#each LEGEND_KEYS as key (key)}
		{@const unavailable = UNAVAILABLE_LEGEND.includes(key)}
		{@const shown = filters.isShown(key)}
		<button
			type="button"
			class={[
				'text-left cursor-pointer rounded-[var(--cg-radius-control)] px-1.5 py-0.5 transition-colors duration-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40',
				shown ? 'text-ink hover:bg-accent/10' : 'text-muted line-through hover:text-ink'
			]}
			aria-pressed={shown}
			disabled={unavailable}
			title={unavailable ? t('legend.unavailable') : shown ? t('legend.hide') : t('legend.reveal')}
			data-legend={key}
			onclick={() => filters.toggleLegend(key)}
		>
			{t(LEGEND_KEY_LABELS[key])}
		</button>
	{/each}
</div>

{#if failure !== null}<p role="alert">{errorText(failure)}</p>{/if}
{#if kinds.length}
	<!-- Typed records are off the ribbon until a Kind is ticked here; the list stays folded
	     until asked for (owner, 2026-09-15). -->
	<details class="border-t border-outline pt-2 text-sm" data-testid="kind-filters">
		<summary class="cursor-pointer text-muted hover:text-ink"
			>{t('legend.kinds')}{#if filters.shownKindIds.size}
				<span class="font-mono text-xs"> · {filters.shownKindIds.size}</span>{/if}</summary
		>
		<div class="mt-2 grid gap-1">
			{#each kinds as kind (kind.id)}
				<label class="flex min-h-7 items-center gap-2">
					<input
						type="checkbox"
						checked={filters.shownKindIds.has(kind.id)}
						onchange={() => filters.toggleKind(kind.id)}
					/>
					<span class="min-w-0 break-words">{kind.name}</span>
				</label>
			{/each}
		</div>
	</details>
{/if}
