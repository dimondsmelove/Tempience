<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { KindHistoryState } from '$lib/state/KindHistory/KindHistory.svelte';
	import { pageCount, pageOf } from '$lib/state/KindHistory/order';
	import type { TraceDatasetRow, TraceDatasetSnapshot } from '$lib/state/triplit/trace-dataset';
	import type { TraceKindV } from '$lib/state/triplit/types';
	import { traceSchemaProjections } from '$lib/model/TraceForm/projections';
	import { columnsRequest, datasetCell, defaultColumnKeys } from './model';
	import Pager from './Pager.svelte';
	let {
		history,
		version,
		versions,
		openingId,
		onselect
	}: {
		history: KindHistoryState;
		version: TraceKindV;
		versions: readonly TraceKindV[];
		openingId: string;
		onselect: (traceId: string) => void;
	} = $props();
	// The structure of the table — its projections and columns — is the schema's and is what
	// the page is read by; the words on it are the language's, and change no request.
	const structures = $derived(traceSchemaProjections(version.dataSchema));
	const structure = $derived(
		structures.find((entry) => entry.id === history.projections[version.id]) ?? structures[0]
	);
	const projections = $derived(traceSchemaProjections(version.dataSchema, locale.current));
	const projection = $derived(
		projections.find((entry) => entry.id === structure?.id) ?? projections[0]
	);
	const keys = $derived(
		structure ? (history.columns[version.id] ?? defaultColumnKeys(structure, version)) : []
	);
	const shown = $derived(
		projection?.columns.filter((field) => keys.includes(field.column.key)) ?? []
	);
	const rows = $derived(history.rowsOf(version.id));
	const pages = $derived(history.pagesOf(version.id));
	const datedIds = $derived(pageOf(rows.dated, pages.dated).map((row) => row.id));
	const undatedPage = $derived(pages.undatedOpen ? pageOf(rows.undated, pages.undated) : []);
	const ids = $derived([...datedIds, ...undatedPage.map((row) => row.id)]);
	let page = $state.raw<TraceDatasetSnapshot | null>(null);
	// The page: the named records of this version with the columns shown, read by id — a
	// lookup — whenever the index delivers, which it does for any change of a record of the
	// Kind, a value included; the order is the index's, not the read's. Nothing follows the
	// page on its own: a live query by ids is a scan of the collection in the installed SDK.
	$effect(() => {
		if (!structure) return;
		void history.index;
		const request = {
			kindId: version.kindId,
			kindVId: version.id,
			ids,
			columns: columnsRequest(structure, keys),
			repeat: structure.repeat
		};
		let current = true;
		void repository.readTraceDataset(request).then((next) => {
			if (current) page = next;
		});
		return () => {
			current = false;
		};
	});
	const byTrace = $derived.by(() => {
		const rows: Record<string, TraceDatasetRow[]> = {};
		if (page?.status !== 'ready') return rows;
		for (const row of page.rows) (rows[row.traceId] ??= []).push(row);
		return rows;
	});
	const fieldNames = $derived(projection?.columns.map((field) => field.label).join(', ') ?? '');
	const toggleColumn = (key: string, checked: boolean) =>
		history.setColumns(
			version.id,
			checked ? [...new Set([...keys, key])] : keys.filter((entry) => entry !== key)
		);
</script>

{#snippet tableOf(list: readonly { id: string; unreadable?: true }[], testId: string)}
	<div class="overflow-x-auto">
		<table class="w-full text-left text-sm">
			<thead
				><tr
					>{#each shown as field (field.column.key)}<th
							scope="col"
							class="border-b border-outline p-2 font-medium">{field.label}</th
						>{/each}<th scope="col" class="border-b border-outline p-2"
						>{t('kindHistory.record')}</th
					></tr
				></thead
			>
			<tbody
				>{#each list as entry (entry.id)}
					{@const traceRows = byTrace[entry.id] ?? []}
					{#each traceRows.length ? traceRows : [null] as row, index (index)}
						<tr data-testid={testId} data-trace-id={entry.id}>
							{#each shown as field (field.column.key)}<td
									class="border-b border-outline p-2 whitespace-nowrap"
									>{#if row}{datasetCell(
											row,
											field,
											projection!,
											versions
										)}{:else if entry.unreadable && field.column.source === 'core'}<span
											class="text-muted">{t('kindHistory.unreadableTime')}</span
										>{:else}…{/if}</td
								>{/each}
							<td class="border-b border-outline p-2"
								><Button
									size="sm"
									variant="quiet"
									disabled={Boolean(openingId)}
									aria-busy={openingId === entry.id}
									onclick={() => onselect(entry.id)}
									>{openingId === entry.id
										? t('kindHistory.opening')
										: t('kindHistory.open')}</Button
								></td
							>
						</tr>
					{/each}
				{/each}</tbody
			>
		</table>
	</div>
{/snippet}

<section
	class="grid min-w-0 gap-3"
	aria-label={t('kindHistory.versionLabel', { generation: version.generation })}
	data-testid="version-table"
	data-version-id={version.id}
>
	<header class="flex min-w-0 flex-wrap items-center gap-2">
		<h2 class="text-base font-semibold">
			{t('kindHistory.versionLabel', { generation: version.generation })}
			<span class="font-mono text-xs text-muted">{version.id.slice(-6)}</span>
		</h2>
		<p class="min-w-0 grow text-xs text-muted">
			{t('kindHistory.versionFields', {
				generation: version.generation,
				fields: fieldNames || '—'
			})}
		</p>
		{#if projections.length > 1}<label class="text-xs text-muted"
				>{t('kindHistory.table')}
				<select
					class="cg-control cg-field"
					value={projection?.id ?? ''}
					onchange={(event) => history.setProjection(version.id, event.currentTarget.value)}
					>{#each projections as entry (entry.id)}<option value={entry.id}>{entry.title}</option
						>{/each}</select
				></label
			>{/if}
		{#if projection}
			<details class="text-xs">
				<summary class="cursor-pointer">{t('kindHistory.columns')}</summary>
				<div class="mt-1 flex flex-wrap gap-2">
					{#each projection.columns as field (field.column.key)}
						{#if field.column.source !== 'core'}
							<label class="flex items-center gap-1"
								><input
									type="checkbox"
									checked={keys.includes(field.column.key)}
									onchange={(event) => toggleColumn(field.column.key, event.currentTarget.checked)}
								/>{field.label}</label
							>
						{/if}
					{/each}
				</div>
			</details>
		{/if}
	</header>
	{#if !projection}
		<p class="text-sm text-muted">{t('kindHistory.noRows')}</p>
	{:else if page?.status === 'error'}
		<p role="alert">{t('kindHistory.pageFailed', { message: page.message })}</p>
	{:else if page?.status === 'incompatible'}
		<p role="alert">
			{t('kindHistory.incompatible', {
				generation: version.generation,
				path: page.issues.map((issue) => issue.path.join('.')).join(', ')
			})}
		</p>
	{:else if !rows.dated.length && !rows.undated.length}
		{@render tableOf([], 'dataset-row')}
		<p class="text-sm text-muted">
			{history.activeFilters ? t('kindHistory.noRowsFiltered') : t('kindHistory.noRows')}
		</p>
	{:else}
		<p class="text-xs text-muted">{t('kindHistory.rows', { count: rows.dated.length })}</p>
		{#if rows.dated.length}
			{#if !page || page.status === 'loading'}<p class="text-xs text-muted">
					{t('kindHistory.rowsLoading')}
				</p>{/if}
			{@render tableOf(pageOf(rows.dated, pages.dated), 'dataset-row')}
			<Pager
				page={pages.dated}
				pages={pageCount(rows.dated.length)}
				label={t('kindHistory.versionLabel', { generation: version.generation })}
				onpage={(next) => history.setPage(version.id, 'dated', next)}
			/>
		{/if}
		{#if rows.undated.length}
			<details
				open={pages.undatedOpen}
				ontoggle={(event) => {
					if (event.currentTarget.open !== pages.undatedOpen) history.toggleUndated(version.id);
				}}
				data-testid="undated-group"
			>
				<summary class="cursor-pointer text-sm font-medium"
					>{t('kindHistory.undated', { count: rows.undated.length })}</summary
				>
				<p class="mb-2 text-xs text-muted">{t('kindHistory.undatedHint')}</p>
				{#if pages.undatedOpen}
					{@render tableOf(undatedPage, 'undated-row')}
					<Pager
						page={pages.undated}
						pages={pageCount(rows.undated.length)}
						label={t('kindHistory.undated', { count: rows.undated.length })}
						onpage={(next) => history.setPage(version.id, 'undated', next)}
					/>
				{/if}
			</details>
		{/if}
	{/if}
</section>
