<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import { GROUP_HEADING_CLASS } from '$lib/context/constants';
	import { historyOperations, type HistoryItem } from '$lib/model/History/history';
	import type { HoverTarget } from '$lib/model/Hover/types';
	import { periodRecordRef } from '$lib/model/PeriodContext/PeriodContext';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { traceSummary } from '$lib/model/TraceForm/summary';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import HistoryOperationView from './HistoryOperation.svelte';

	let { records, workbench }: { records: RecordsReader; workbench: WorkbenchState } = $props();
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
	/**
	 * What an entry lights on the ribbon under the pointer (loop 008, C3): the record it is
	 * about, the Scope of a membership, both ends of a link, the fact behind a statement — the
	 * intention itself for a direct one — and the time of a period; nothing for the rest.
	 */
	const lensOf = (item: HistoryItem): HoverTarget => {
		const result = records.result;
		switch (item.entityType) {
			case 'trace':
				return { kind: 'trace', traceId: item.entityId };
			case 'scope':
				return { kind: 'scope', scopeId: item.entityId };
			case 'intersection': {
				const membership = result?.memberships.find((entry) => entry.linkId === item.entityId);
				if (membership) return { kind: 'scope', scopeId: membership.scopeId };
				const link = [...(result?.links ?? []), ...(result?.withdrawnLinks ?? [])].find(
					(entry) => entry.linkId === item.entityId
				);
				return link && result ? { kind: 'traces', traceIds: [result.traceId, link.otherId] } : null;
			}
			case 'intentionAssessment': {
				const source = result?.result?.sources.find((entry) => entry.id === item.entityId);
				return source && result
					? { kind: 'trace', traceId: source.factId ?? result.traceId }
					: null;
			}
			case 'period': {
				const record = workbench.view.periods.find((entry) => entry.id === item.entityId);
				const period = record ? periodRecordRef(record) : null;
				return period ? { kind: 'period', period } : null;
			}
			default:
				return null;
		}
	};
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
					<HistoryOperationView {operation} {names} hover={workbench.hover} {lensOf} />
				</li>
			{/each}
		</ol>
	{:else if !records.loading}
		<p class="text-sm text-muted" data-testid="history-empty">{t('history.empty')}</p>
	{/if}
</section>
