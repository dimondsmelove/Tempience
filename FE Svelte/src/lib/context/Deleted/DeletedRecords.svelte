<script lang="ts">
	import { untrack } from 'svelte';
	import { GROUP_HEADING_CLASS, LIST_BUTTON_CLASS } from '$lib/context/constants';
	import TraceValues from '$lib/context/TraceValues/TraceValues.svelte';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { DeletedRecordsReader } from '$lib/state/Records/Deleted.svelte';
	import { DeletedScopesReader } from '$lib/state/Records/DeletedScopes.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';

	let { workbench }: { workbench: WorkbenchState } = $props();
	const deleted = new DeletedRecordsReader(tempienceRepository);
	const scopes = new DeletedScopesReader(tempienceRepository);
	let open = $state(false);
	// A language switch renames what the list holds; nothing is read again for it.
	$effect(() => {
		void locale.current;
		untrack(() => deleted.redisplay());
	});
	$effect(() => {
		if (!open) return;
		untrack(() => {
			void deleted.load();
			void scopes.load();
		});
		const stops = untrack(() => [deleted.watch(), scopes.watch()]);
		return () => {
			for (const stop of stops) stop();
		};
	});
</script>

<!-- The records that are not on the timeline any more. Opening one shows it as it stands and
     offers the way back; none of them is put on the ribbon by being listed here. -->
<div class="flex flex-col gap-1" data-testid="deleted-records">
	<Button size="sm" variant="quiet" data-testid="deleted-open" onclick={() => (open = !open)}
		>{open ? t('deleted.hide') : t('deleted.show')}</Button
	>
	{#if open}
		<h3 class={GROUP_HEADING_CLASS}>{t('deleted.title')}</h3>
		{#if deleted.error}
			<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="deleted-error">
				{t('link.readFailed', { message: deleted.error })}
				<Button size="sm" variant="quiet" onclick={() => void deleted.load()}
					>{t('kind.retryLoad')}</Button
				>
			</p>
		{/if}
		{#if deleted.records.length}
			<ul class="flex flex-col gap-1">
				{#each deleted.records as record (record.trace.id)}
					<li>
						<button
							type="button"
							class={LIST_BUTTON_CLASS}
							data-testid="deleted-record"
							onclick={() => workbench.selectTrace(record.trace.id, 'context')}
						>
							<span>{record.summary.title ?? t('trace.unnamed')}</span>
							<span class="font-mono text-xs text-muted"
								>{traceTimeLabel(record.trace, locale.current)}</span
							>
							<TraceValues summary={record.summary} />
						</button>
					</li>
				{/each}
			</ul>
		{:else if !deleted.loading}
			<p class="text-sm text-muted" data-testid="deleted-empty">{t('deleted.empty')}</p>
		{/if}
		<h3 class={GROUP_HEADING_CLASS}>{t('deleted.scopesTitle')}</h3>
		{#if scopes.error}
			<p
				role="alert"
				class="text-sm text-[color:var(--cg-danger)]"
				data-testid="deleted-scopes-error"
			>
				{t('link.readFailed', { message: scopes.error })}
				<Button size="sm" variant="quiet" onclick={() => void scopes.load()}
					>{t('kind.retryLoad')}</Button
				>
			</p>
		{/if}
		{#if scopes.records.length}
			<ul class="flex flex-col gap-1">
				{#each scopes.records as entry (entry.scope.id)}
					<li>
						<!-- Opening one shows it as it stands and what its return would bring back. -->
						<button
							type="button"
							class={LIST_BUTTON_CLASS}
							data-testid="deleted-scope-item"
							onclick={() => workbench.selectScope(entry.scope.id, 'context')}
						>
							<span>{entry.scope.name}</span>
							<span class="text-xs text-muted"
								>{t('scope.recordsInside', { count: entry.records })}</span
							>
						</button>
					</li>
				{/each}
			</ul>
		{:else if !scopes.loading}
			<p class="text-sm text-muted" data-testid="deleted-scopes-empty">
				{t('deleted.scopesEmpty')}
			</p>
		{/if}
	{/if}
</div>
