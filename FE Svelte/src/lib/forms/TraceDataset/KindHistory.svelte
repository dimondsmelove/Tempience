<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { onMount } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { KindHistoryState } from '$lib/state/KindHistory/KindHistory.svelte';
	import type { Scope, TraceKindV } from '$lib/state/triplit/types';
	import HistoryFilters from './HistoryFilters.svelte';
	import VersionTable from './VersionTable.svelte';
	import { filterFields } from './model';
	let {
		history,
		versions,
		onselect
	}: {
		history: KindHistoryState;
		versions: readonly TraceKindV[];
		onselect: (traceId: string) => void | Promise<void>;
	} = $props();
	let scopes = $state.raw<Scope[]>([]);
	let failure = $state.raw<unknown>(null);
	let openingId = $state('');
	onMount(() =>
		repository.subscribeScopes(
			(rows) => {
				scopes = rows;
			},
			(cause) => {
				failure = cause ?? new Error();
			}
		)
	);
	// The index: every active record of the Kind under the Scope and value filters, thin, held
	// while the history is shown and renewed when those filters change; the versions, the
	// period and the pages are decided on it here, never by another read.
	$effect(() => {
		const request = history.indexRequest;
		return repository.subscribeKindIndex(request, (next) => {
			history.index = next;
		});
	});
	const fields = $derived(filterFields(versions));
	const shown = $derived(history.shown(versions));
	async function open(id: string) {
		if (openingId) return;
		openingId = id;
		try {
			await onselect(id);
		} finally {
			openingId = '';
		}
	}
</script>

<div class="grid min-w-0 gap-4">
	<HistoryFilters {history} {versions} {scopes} {fields} />
	{#if failure !== null}<p role="alert">{errorText(failure)}</p>{/if}
	{#if history.index?.status === 'error'}
		<p role="alert">{t('kindHistory.readFailed', { message: history.index.message })}</p>
	{:else if history.index?.status === 'incompatible'}
		<p role="alert">
			{t('kindHistory.incompatible', {
				generation: history.index.issues[0]?.generation ?? '',
				path: history.index.issues.map((issue) => issue.path.join('.')).join(', ')
			})}
		</p>
	{:else if !history.index || history.index.status === 'loading'}
		<p class="text-sm text-muted">{t('kindHistory.loading')}</p>
	{:else if !shown.length}
		<p class="text-sm text-muted">{t('kindHistory.noVersions')}</p>
	{:else}
		{#each shown as version (version.id)}
			<VersionTable {history} {version} {versions} {openingId} onselect={open} />
		{/each}
	{/if}
</div>
