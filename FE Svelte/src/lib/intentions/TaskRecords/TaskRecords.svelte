<script lang="ts">
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import type { TaskRecordsProps } from './types';
	import { RECORD_OUTCOME_KEYS } from './constants';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { offerUndo } from '$lib/context/undo';
	import { writeThenRead } from '$lib/context/write';
	import ContextSection from '$lib/context/ContextSection/ContextSection.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import Popover from '$lib/ui/Popover/Popover.svelte';
	import { TrashBinOutline } from 'flowbite-svelte-icons';
	import OutcomeIcon from '../OutcomeIcon/OutcomeIcon.svelte';
	import { intentionRecordRows } from '../Results/Results';
	import { traceDate } from '../Board/panel';
	import { recordCandidates } from './TaskRecords';
	let {
		taskId,
		traces,
		links,
		assessments,
		zone,
		undo,
		reload,
		collapsed,
		ontoggle
	}: TaskRecordsProps = $props();
	let query = $state('');
	let busy = $state(false);
	let refusal = $state.raw<unknown>(null);
	let readFailure = $state.raw<unknown>(null);
	const rows = $derived(intentionRecordRows(taskId, traces, links, assessments));
	const candidates = $derived(
		recordCandidates(
			traces,
			taskId,
			rows.map((row) => row.trace.id),
			query
		)
	);
	const popoverId = $derived(`task-records-search-${taskId}`);
	const date = (trace: ExplorerTrace) => {
		const day = traceDate(trace, zone);
		return day
			? new Intl.DateTimeFormat(locale.current, {
					weekday: 'short',
					day: 'numeric',
					timeZone: 'UTC'
				})
					.format(new Date(`${day}T12:00:00Z`))
					.replace(',', '')
					.replace('.', '')
			: '';
	};
	const retry = async () => {
		try {
			await reload();
			readFailure = null;
		} catch (cause) {
			readFailure = cause ?? new Error();
		}
	};
	const remove = async (id: string) => {
		busy = true;
		const outcome = await offerUndo({
			undo,
			space: activeDataSpace.id,
			repository: tempienceRepository,
			label: () => t('overview.deleted'),
			write: async () => {
				const { operation } = await tempienceRepository.setTraceDeleted(id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read: reload
		});
		refusal = outcome.refusal;
		readFailure = outcome.readFailure;
		busy = false;
	};
	const link = async (id: string, close: () => void) => {
		busy = true;
		const outcome = await writeThenRead(
			() =>
				tempienceRepository
					.createIntersection({ fromId: id, toId: taskId, kind: 'evidence_for' }, 'user')
					.then(() => {}),
			reload
		);
		refusal = outcome.refusal;
		readFailure = outcome.readFailure;
		if (outcome.written) {
			query = '';
			close();
		}
		busy = false;
	};
</script>

<ContextSection
	id="task-results"
	label={t('intentions.records')}
	title="{t('intentions.records')} · {rows.length}"
	{collapsed}
	{ontoggle}
>
	{#if refusal}<p role="alert" class="error">{errorText(refusal)}</p>{/if}
	{#if readFailure}<p role="alert" class="error">
			{t('link.readFailed', { message: errorText(readFailure) })}
			<Button size="sm" variant="quiet" onclick={() => void retry()}>{t('kind.retryLoad')}</Button>
		</p>{/if}
	{#if rows.length}
		<ul class="records">
			{#each rows as row (row.trace.id)}
				<li class="record" data-testid="task-record">
					<span class="icon"><OutcomeIcon outcome={row.outcome} size={14} /></span>
					<span class="title"
						>{row.trace.displayTitle ?? row.trace.content}{#if row.outcome}<span class="kind"
								>&nbsp;·&nbsp;{t(RECORD_OUTCOME_KEYS[row.outcome])}</span
							>{/if}</span
					>
					<span class="date">{date(row.trace)}</span>
					<span class="delete"
						><Button
							size="sm"
							variant="quiet"
							icon
							aria-label={t('intentions.deleteRecord')}
							title={t('intentions.deleteRecord')}
							disabled={busy}
							onclick={() => void remove(row.trace.id)}><TrashBinOutline class="h-4 w-4" /></Button
						></span
					>
				</li>
			{/each}
		</ul>
	{:else}<p class="empty">{t('intentions.recordsEmpty')}</p>{/if}
	<Popover
		class="task-records-attach"
		id={popoverId}
		label={t('intentions.attachRecordTitle')}
		testId="attach-record"
		disabled={busy}
	>
		{#snippet trigger()}{t('intentions.attachRecord')}{/snippet}
		{#snippet children(close)}
			<div class="search-panel">
				<strong>{t('intentions.attachRecordTitle')}</strong>
				<input
					class="cg-control cg-control-sm cg-field"
					aria-label={t('intentions.recordsSearch')}
					placeholder={t('intentions.recordsSearch')}
					bind:value={query}
				/>
				{#each candidates as candidate (candidate.id)}
					<button
						type="button"
						class="candidate"
						data-testid="record-candidate"
						data-record-id={candidate.id}
						disabled={busy}
						onclick={() => void link(candidate.id, close)}
						><span>{candidate.displayTitle ?? candidate.content}</span><span class="date"
							>{date(candidate)}</span
						></button
					>
				{:else}<p class="empty">{t('intentions.recordsNoMatches')}</p>{/each}
			</div>
		{/snippet}
	</Popover>
</ContextSection>

<style>
	:global(.task-records-attach) {
		align-self: flex-start;
	}
	.records {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.record {
		display: flex;
		gap: 0.375rem;
		align-items: flex-start;
		min-width: 0;
		font-size: 0.8125rem;
	}
	.icon {
		padding-top: 0.2rem;
		flex: none;
	}
	.title {
		flex: 1;
		min-width: 0;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.kind,
	.date,
	.empty {
		color: var(--cg-text-muted);
	}
	.date {
		white-space: nowrap;
		font: 0.75rem var(--cg-font-mono);
		line-height: 1.5rem;
	}
	.delete {
		opacity: 0;
		flex: none;
	}
	.record:hover .delete,
	.record:focus-within .delete {
		opacity: 1;
	}
	.delete :global(button) {
		min-width: 1.25rem;
		min-height: 1.25rem;
		padding: 0;
	}
	.empty {
		font-size: 0.75rem;
	}
	.error {
		color: var(--cg-danger);
		font-size: 0.875rem;
	}
	.search-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		width: min(20rem, calc(100vw - 2rem));
	}
	.search-panel strong {
		font-size: 0.8125rem;
	}
	.candidate {
		display: flex;
		justify-content: space-between;
		gap: 0.5rem;
		text-align: left;
		font-size: 0.8125rem;
		overflow-wrap: anywhere;
	}
	.candidate:hover,
	.candidate:focus-visible {
		background: var(--cg-bg-hover);
	}
	@media (hover: none) {
		.delete {
			opacity: 1;
		}
	}
</style>
