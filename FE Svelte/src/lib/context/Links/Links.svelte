<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { SvelteMap } from 'svelte/reactivity';
	import { GROUP_HEADING_CLASS, LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { linkGroupLabel } from '$lib/context/labels';
	import TraceValues from '$lib/context/TraceValues/TraceValues.svelte';
	import { traceTimeLabel } from '$lib/model/Projection/marks';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import type { RecordsReader } from '$lib/state/Records/Records.svelte';
	import type { LinkedRecord } from '$lib/state/Records/types';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import type { TraceIntersectionKind } from '$lib/state/triplit/types';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { readContext } from '$lib/context/reload';
	import Retarget from '$lib/context/Retarget/Retarget.svelte';
	import { offerUndo } from '$lib/context/undo';
	import { writeThenRead } from '$lib/context/write';
	import { LINK_KINDS, SEARCH_LIMIT } from './constants';
	import { ENDPOINT_KEYS } from './endpoints';

	let {
		workbench,
		traceId,
		records,
		searchOpen = $bindable(false)
	}: {
		workbench: WorkbenchState;
		traceId: string;
		records: RecordsReader;
		/** The search for a related record, opened here or by the Overview's own action. */
		searchOpen?: boolean;
	} = $props();
	const snapshot = $derived(workbench.view);
	/** Every explicit link of the record, grouped as the Context reads them. */
	const groups = $derived.by((): { label: string; items: LinkedRecord[] }[] => {
		const byLabel = new SvelteMap<string, LinkedRecord[]>();
		for (const link of records.links) {
			const label = linkGroupLabel(link.kind, link.direction === 'outgoing');
			byLabel.set(label, [...(byLabel.get(label) ?? []), link]);
		}
		return [...byLabel].map(([label, items]) => ({ label, items }));
	});
	let query = $state('');
	let kind = $state<TraceIntersectionKind>('related_to');
	let busy = $state(false);
	/** A link the repository refuses (roles, a deleted end, a second original) is said here. */
	let refusal = $state.raw<unknown>(null);
	/** The command was accepted but its result could not be read; only reading is retried. */
	let readFailure = $state.raw<unknown>(null);
	const candidates = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return [];
		return snapshot.traces
			.filter(
				(trace) =>
					trace.id !== traceId &&
					`${trace.displayTitle ?? ''} ${trace.content}`.toLowerCase().includes(needle)
			)
			.slice(0, SEARCH_LIMIT);
	});
	/**
	 * The snapshot feeds the timeline; the reader feeds these rows. Either refusing to be read
	 * is one failure a command can report, and retrying repeats both readings — never the write.
	 */
	const reload = (): Promise<void> => readContext(workbench, records, loadWorkbenchSnapshot);
	const retryRead = async (): Promise<void> => {
		try {
			await reload();
			readFailure = null;
		} catch (cause) {
			readFailure = cause ?? new Error();
		}
	};
	const link = async (otherId: string): Promise<void> => {
		busy = true;
		const outcome = await writeThenRead(
			() =>
				tempienceRepository
					.createIntersection({ fromId: traceId, toId: otherId, kind }, 'user')
					.then(() => {}),
			reload
		);
		refusal = outcome.refusal;
		readFailure = outcome.readFailure;
		if (outcome.written) {
			query = '';
			searchOpen = false;
		}
		busy = false;
	};
	/** Removing a link is a soft delete the toast can take back (DP23). */
	const unlink = async (linkId: string, label: string): Promise<void> => {
		busy = true;
		// The offer belongs to the commit itself: it names the operation the repository just
		// accepted, and taking it back is the causal inverse of that operation.
		const outcome = await offerUndo({
			undo: workbench.undo,
			space: activeDataSpace.id,
			repository: tempienceRepository,
			label: () => t('link.removed', { title: label }),
			write: async () => {
				const { operation } = await tempienceRepository.setIntersectionDeleted(
					linkId,
					true,
					'user'
				);
				return { operationId: operation?.id ?? null };
			},
			read: reload
		});
		refusal = outcome.refusal;
		readFailure = outcome.readFailure;
		busy = false;
	};
	const labelOf = (item: LinkedRecord): string => item.summary?.title ?? t('trace.unnamed');
</script>

<section class="flex flex-col gap-3" data-testid="context-links">
	{#if records.error || readFailure !== null}
		<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="links-error">
			{t('link.readFailed', { message: records.error || errorText(readFailure) })}
			<Button size="sm" variant="quiet" data-testid="links-retry" onclick={() => void retryRead()}
				>{t('kind.retryLoad')}</Button
			>
		</p>
	{/if}
	{#if groups.length}
		{#each groups as group (group.label)}
			<div class="flex flex-col gap-1">
				<h3 class={GROUP_HEADING_CLASS}>{group.label}</h3>
				<ul class="flex flex-col gap-1">
					{#each group.items as item (item.linkId ?? `${item.kind}:${item.otherId}`)}
						<li class="flex flex-col gap-1" data-testid="link-row" data-other={item.otherId}>
							<div class="flex items-center gap-1">
								<!-- A record the timeline does not carry is still named here, with what is
							     known about it; it is never dropped from the list or added to the ribbon. -->
								<button
									type="button"
									class={LIST_BUTTON_CLASS}
									data-testid="link-target"
									data-state={item.state}
									disabled={item.state === 'unavailable'}
									onclick={() => workbench.selectTrace(item.otherId, 'context')}
								>
									<span>{labelOf(item)}</span>
									{#if item.trace}
										<span class="font-mono text-xs text-muted"
											>{traceTimeLabel(item.trace, locale.current)}</span
										>
									{/if}
									{#if item.summary}<TraceValues summary={item.summary} />{/if}
									{#if item.state !== 'active'}
										<span class="text-xs text-muted" data-testid="link-endpoint-state"
											>{t(ENDPOINT_KEYS[item.state])}</span
										>
									{/if}
								</button>
								{#if item.linkId}
									<Button
										size="sm"
										variant="quiet"
										data-testid="link-details"
										title={t('link.details')}
										onclick={() => workbench.selectIntersection(item.linkId!)}
										>{t('links.link')}</Button
									>
									<Button
										size="sm"
										variant="quiet"
										disabled={busy}
										data-testid="link-remove"
										title={t('link.remove')}
										onclick={() => unlink(item.linkId!, labelOf(item))}>{t('links.unlink')}</Button
									>
								{/if}
							</div>
							{#if item.linkId && item.kind === 'evidence_for' && item.direction === 'outgoing'}
								<!-- The address of a result link is corrected explicitly, with or without a
								     statement made through it; it is never an unlink followed by a new link. -->
								<div data-testid="link-retarget">
									<Retarget
										undo={workbench.undo}
										{records}
										evidenceId={item.linkId}
										read={reload}
										onwritten={(outcome) => {
											refusal = outcome.refusal;
											readFailure = outcome.readFailure;
										}}
									/>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{:else if !records.loading}
		<p class="text-sm text-muted">{t('links.none')}</p>
	{/if}
	{#if searchOpen}
		<div class="flex flex-col gap-1" data-testid="link-search-block">
			<div class="flex gap-1">
				<input
					class="cg-field min-w-0 flex-1 text-sm"
					type="search"
					placeholder={t('links.searchPlaceholder')}
					aria-label={t('links.search')}
					data-testid="link-search"
					bind:value={query}
				/>
				<select
					class="cg-control cg-control-sm border border-outline bg-[var(--cg-bg-input)] text-ink"
					aria-label={t('links.kind')}
					data-testid="link-kind"
					bind:value={kind}
				>
					{#each LINK_KINDS as [value, label] (value)}<option {value}>{t(label)}</option>{/each}
				</select>
			</div>
			{#if refusal}
				<p role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="link-refused">
					{t('context.linkFailed', { message: errorText(refusal) })}
				</p>
			{/if}
			{#if candidates.length}
				<ul class="flex flex-col gap-1">
					{#each candidates as candidate (candidate.id)}
						<li>
							<button
								type="button"
								class={LIST_BUTTON_CLASS}
								disabled={busy}
								data-testid="link-candidate"
								onclick={() => link(candidate.id)}
							>
								<span>{candidate.displayTitle ?? candidate.content}</span>
								<span class="font-mono text-xs text-muted"
									>{traceTimeLabel(candidate, locale.current)}</span
								>
							</button>
						</li>
					{/each}
				</ul>
			{:else if query.trim()}
				<p class="text-sm text-muted">{t('links.nothingFound')}</p>
			{/if}
			<div>
				<Button size="sm" variant="quiet" onclick={() => (searchOpen = false)}
					>{t('links.close')}</Button
				>
			</div>
		</div>
	{:else}
		<div class="flex flex-wrap gap-1">
			<Button size="sm" data-testid="link-search-open" onclick={() => (searchOpen = true)}
				>{t('links.open')}</Button
			>
			{#if refusal}
				<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="link-refused"
					>{t('context.linkFailed', { message: errorText(refusal) })}</span
				>
			{/if}
		</div>
	{/if}
</section>
