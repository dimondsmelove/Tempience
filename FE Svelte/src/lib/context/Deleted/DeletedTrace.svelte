<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { GROUP_HEADING_CLASS, LIST_BUTTON_CLASS } from '$lib/context/constants';
	import History from '$lib/context/History/History.svelte';
	import { linkGroupLabel } from '$lib/context/labels';
	import TraceValues from '$lib/context/TraceValues/TraceValues.svelte';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { lensSource } from '$lib/ui/LensSource';
	import type { RestoreState } from './restore.svelte';

	let {
		workbench,
		traceId,
		records,
		restore
	}: {
		workbench: WorkbenchState;
		traceId: string;
		/** The Context's reader of this record; a deleted record is read like any other. */
		records: RecordsReader;
		/** The way back, owned above this panel because this panel does not outlive it. */
		restore: RestoreState;
	} = $props();
	const record = $derived(records.result?.traceId === traceId ? records.result : null);
	const trace = $derived(record?.trace ?? null);
	/** The record's own name, Kind and values, read the way every other record's are read. */
	const summary = $derived(record?.summary ?? null);
	/**
	 * Which of the four things this is: still being read, refused, known and deleted, or here
	 * and simply not on the timeline — a record another device brought back is the last one,
	 * and calling it «unavailable on this device» would be untrue.
	 */
	const presence = $derived(
		records.error
			? 'error'
			: !record
				? 'reading'
				: !trace
					? 'absent'
					: trace.isDeleted
						? 'deleted'
						: 'present'
	);
</script>

<!-- A record that is not on the timeline any more, read as it stands: what it was, what it
     still names, what happened to it, and the one way back. Nothing here is put on the ribbon. -->
<section class="flex min-h-0 flex-col gap-3" data-testid="deleted-trace" data-trace={traceId}>
	<div class="grid gap-1">
		<h2 class="text-lg leading-snug font-semibold break-words" data-testid="selected-title">
			{summary?.title ?? trace?.content ?? t('trace.unnamed')}
		</h2>
		{#if trace}
			<p class="font-mono text-xs text-muted" data-testid="selected-time">
				{traceTimeLabel(trace, locale.current)}
			</p>
		{/if}
		<!-- Its own values and what could not be read of them, as every row of records shows
		     them; a typed record is named by its Kind in the title above, as it is everywhere. -->
		{#if summary}
			<div class="flex flex-wrap items-center gap-2">
				<TraceValues {summary} limit={6} />
			</div>
		{/if}
		{#if records.error}
			<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="deleted-error">
				{t('link.readFailed', { message: records.error })}
				<Button size="sm" variant="quiet" onclick={() => void records.reload()}
					>{t('kind.retryLoad')}</Button
				>
			</p>
		{:else}
			<p
				class={presence === 'present'
					? 'text-sm text-muted'
					: 'text-sm text-[color:var(--cg-danger)]'}
				role="status"
				data-testid="deleted-state"
				data-state={presence}
			>
				{presence === 'reading'
					? t('deleted.reading')
					: presence === 'absent'
						? t('deleted.unavailable')
						: presence === 'present'
							? t('deleted.present')
							: t('deleted.state')}
			</p>
		{/if}
		{#if summary?.description ?? trace?.description}
			<p class="text-sm whitespace-pre-wrap" data-testid="selected-description">
				{summary?.description ?? trace?.description}
			</p>
		{/if}
	</div>
	<div class="flex flex-wrap items-center gap-2">
		<!-- Only a record that is actually deleted has a way back; the others have nothing to undo. -->
		<Button
			size="sm"
			variant="primary"
			disabled={restore.busy || presence !== 'deleted'}
			data-testid="restore-trace"
			onclick={() => void restore.run()}>{t('deleted.restore')}</Button
		>
		{#if restore.refusal}
			<!-- Refused: the record is still deleted, and this panel is here to say why. -->
			<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="restore-error"
				>{t('deleted.restoreFailed', { message: errorText(restore.refusal) })}</span
			>
		{/if}
	</div>
	{#if record?.links.length}
		<div class="flex flex-col gap-1">
			<h3 class={GROUP_HEADING_CLASS}>{t('deleted.links')}</h3>
			<ul class="flex flex-col gap-1">
				{#each record.links as link (link.linkId ?? `${link.kind}:${link.otherId}`)}
					<li>
						<!-- Its own additions stay reachable from here, whatever became of them. -->
						<button
							type="button"
							class={LIST_BUTTON_CLASS}
							data-testid="link-target"
							data-state={link.state}
							disabled={link.state === 'unavailable'}
							onclick={() => workbench.selectTrace(link.otherId, 'context')}
							{@attach lensSource(workbench.hover, { kind: 'trace', traceId: link.otherId })}
						>
							<span>{link.summary?.title ?? t('trace.unnamed')}</span>
							<span class="text-xs text-muted"
								>{linkGroupLabel(link.kind, link.direction === 'outgoing')}</span
							>
							{#if link.summary}<TraceValues summary={link.summary} />{/if}
						</button>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
	<History {records} {workbench} />
</section>
