<script lang="ts">
	import { dateTimeFormat } from '$lib/state/Locale/format';
	import { formatDay } from '$lib/context/labels';
	import type { HistoryOperation } from '$lib/model/History/history';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import {
		ACTION_KEYS,
		CAUSE_KEYS,
		SUBJECT_KEYS,
		fieldKey,
		valueText,
		visibleChanges
	} from './format';

	let {
		operation,
		names
	}: {
		operation: HistoryOperation;
		/** How the things of this operation and the records its values name are called here. */
		names: ReadonlyMap<string, string>;
	} = $props();
	const at = $derived(new Date(operation.occurredAt));
	const when = $derived(
		`${formatDay(at.getTime())} · ${dateTimeFormat(locale.current, { hour: '2-digit', minute: '2-digit' }).format(at)}`
	);
</script>

<article
	class="grid gap-1 rounded border border-outline p-2"
	data-testid="history-operation"
	data-operation={operation.operationId}
	data-cause={operation.cause}
>
	<div class="flex flex-wrap items-center gap-2">
		<span class="font-mono text-xs text-muted" data-testid="history-when">{when}</span>
		<span class="text-xs text-muted" data-testid="history-cause"
			>{t(CAUSE_KEYS[operation.cause])}</span
		>
	</div>
	<ul class="grid gap-1">
		{#each operation.items as item, index (index)}
			{@const changes = visibleChanges(item)}
			<li class="text-sm" data-testid="history-item" data-entity={item.entityType}>
				<span class="text-muted"
					>{t(SUBJECT_KEYS[item.entityType])} · {t(ACTION_KEYS[item.action])}</span
				>
				{#if names.get(item.entityId)}
					<span data-testid="history-subject">«{names.get(item.entityId)}»</span>
				{/if}
				{#if changes.length}
					<dl class="mt-1 grid gap-1">
						{#each changes as change (change.field)}
							{@const label = fieldKey(change.field)}
							<div class="grid gap-0.5">
								<dt class="text-xs text-muted">{label ? t(label) : change.field}</dt>
								<!-- The old text stays exactly as it was written, so it can be read and copied. -->
								<dd class="text-sm break-words whitespace-pre-wrap" data-testid="history-change">
									<span data-testid="history-before"
										>{valueText(change.field, change.before, names) ?? t('history.nothing')}</span
									>
									<span aria-hidden="true"> → </span>
									<span data-testid="history-after"
										>{valueText(change.field, change.after, names) ?? t('history.nothing')}</span
									>
								</dd>
							</div>
						{/each}
					</dl>
				{/if}
			</li>
		{/each}
	</ul>
</article>
