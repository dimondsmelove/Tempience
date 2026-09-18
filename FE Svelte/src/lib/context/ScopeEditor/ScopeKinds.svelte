<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceKind } from '$lib/state/triplit/types';
	import Button from '$lib/ui/Button/Button.svelte';

	let {
		kinds,
		busy,
		error,
		onopen,
		oncreate
	}: {
		kinds: readonly TraceKind[];
		busy: boolean;
		error: string;
		/** Opens the Kind's history; the list only names the Kinds without it. */
		onopen?: (kind: TraceKind) => void;
		/** Starts a new Kind with this Scope shown as its membership (TRACE_FORMS navigation). */
		oncreate?: () => void;
	} = $props();
</script>

<!-- The Kinds directly bound to this Scope (core/trace-scope): no subtree, no legacy suggestions.
     A plain list inside the Scope's own section; the section folds, this block does not. -->
<div class="grid gap-2 text-sm" data-testid="scope-kinds">
	{#if !busy}
		<ul class="grid gap-1" aria-label={t('scope.kinds')}>
			{#each kinds as kind (kind.id)}
				<li data-testid="scope-kind">
					{#if onopen}
						<button
							type="button"
							class="cursor-pointer text-left underline decoration-dotted hover:text-accent"
							aria-label={t('scope.openKind', { name: kind.name })}
							onclick={() => onopen(kind)}>{kind.name}</button
						>
					{:else}{kind.name}{/if}
				</li>
			{:else}
				<li class="text-muted">{t('scope.kindsEmpty')}</li>
			{/each}
		</ul>
	{/if}
	{#if error}<p role="alert">{error}</p>{/if}
	{#if oncreate}
		<Button size="sm" class="justify-self-start" data-testid="scope-new-kind" onclick={oncreate}
			>{t('draft.kindNew')}</Button
		>
	{/if}
</div>
