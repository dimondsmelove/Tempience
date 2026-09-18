<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { GROUP_HEADING_CLASS } from '$lib/context/constants';
	import { historyOperations } from '$lib/model/History/history';
	import { traceSummary } from '$lib/model/TraceForm/summary';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import HistoryOperationView from './HistoryOperation.svelte';

	let { records }: { records: RecordsReader } = $props();
	/** The journal of this record and of everything it names, grouped one operation per entry. */
	const operations = $derived(historyOperations(records.logs));
	/**
	 * How this Context names things: the links, statements and memberships an entry is about,
	 * and the records an entry's own values name. One map, because an id is one thing.
	 */
	const names = $derived.by((): ReadonlyMap<string, string> => {
		const names = new SvelteMap<string, string>();
		const result = records.result;
		if (!result) return names;
		names.set(result.traceId, result.summary?.title ?? t('trace.unnamed'));
		for (const link of [...result.links, ...result.withdrawnLinks]) {
			const title = link.summary?.title ?? t('trace.unnamed');
			if (link.linkId) names.set(link.linkId, title);
			names.set(link.otherId, title);
		}
		for (const membership of result.memberships) {
			names.set(membership.linkId, membership.name ?? t('scope.unnamed'));
		}
		for (const source of result.result?.sources ?? []) {
			names.set(source.id, source.factSummary?.title ?? t('result.byDirect'));
		}
		// The records the journal's values name beyond the answer, read for it by id.
		for (const head of records.named) {
			if (names.has(head.id)) continue;
			names.set(
				head.id,
				traceSummary(head, records.catalog ?? undefined, locale.current).title ?? t('trace.unnamed')
			);
		}
		return names;
	});
</script>

<!-- What happened to this record, as its own journal records it (S14): one entry per
     operation, its own fields and the links and statements it named, newest first. The old
     text is shown as it was written, so it can be read and copied. -->
<section class="flex flex-col gap-2" data-testid="context-history">
	{#if records.error}
		<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="history-error">
			{t('link.readFailed', { message: records.error })}
			<Button size="sm" variant="quiet" onclick={() => void records.reload()}
				>{t('kind.retryLoad')}</Button
			>
		</p>
	{/if}
	{#if operations.length}
		<h3 class={GROUP_HEADING_CLASS}>{t('history.title')}</h3>
		<ol class="flex flex-col gap-2" data-testid="history-list">
			{#each operations as operation (operation.operationId)}
				<li>
					<HistoryOperationView {operation} {names} />
				</li>
			{/each}
		</ol>
	{:else if !records.loading}
		<p class="text-sm text-muted" data-testid="history-empty">{t('history.empty')}</p>
	{/if}
</section>
