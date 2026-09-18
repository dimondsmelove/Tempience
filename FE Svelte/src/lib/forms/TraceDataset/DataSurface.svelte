<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import { onMount } from 'svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import KindHistory from './KindHistory.svelte';
	import { tempienceRepository as repository } from '$lib/state/triplit';
	import type { TraceKind, TraceKindV } from '$lib/state/triplit/types';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	let { workbench }: { workbench: WorkbenchState } = $props();
	let kinds = $state.raw<TraceKind[]>([]);
	let versions = $state.raw<TraceKindV[]>([]);
	let loading = $state(true);
	let failure = $state.raw<unknown>(null);
	const target = $derived(workbench.forms.data);
	const history = $derived(workbench.forms.history);
	const kind = $derived(kinds.find((entry) => entry.id === target?.kindId));
	const kindVersions = $derived(versions.filter((entry) => entry.kindId === target?.kindId));
	onMount(() => {
		let kindsReady = false,
			versionsReady = false;
		const fail = (cause: unknown) => {
			failure = cause ?? new Error();
			loading = false;
		};
		const subscriptions = [
			repository.subscribeTraceKinds((rows) => {
				kinds = rows;
				kindsReady = true;
				loading = !versionsReady;
			}, fail),
			repository.subscribeTraceKindVersions((rows) => {
				versions = rows;
				versionsReady = true;
				loading = !kindsReady;
			}, fail)
		];
		return () => subscriptions.forEach((unsubscribe) => unsubscribe());
	});
	/** A row becomes the Context, which reads the record itself; the timeline behind is not read. */
	function openTrace(id: string) {
		workbench.selectTrace(id, 'context');
	}
</script>

<!-- The Kind's table in the centre. Its actions — the ribbon, the Kind's page, «Записать» —
     are the toolbar's (owner, 2026-09-18); the header only names what is shown. -->
<section
	class="cg-panel grid min-w-0 content-start gap-4"
	aria-label={t('kindHistory.title')}
	data-testid="kind-data-surface"
>
	<header class="min-w-0">
		<p class="text-xs text-muted">{t('kindHistory.title')}</p>
		<h1 class="text-xl font-semibold break-words">{kind?.name ?? t('kindHistory.kind')}</h1>
	</header>
	{#if failure !== null}<p role="alert">{errorText(failure)}</p>{/if}
	{#if loading}<p class="text-sm text-muted">{t('kindHistory.loading')}</p>
	{:else if kind && history && target}
		{#key kind.id}
			<KindHistory {history} versions={kindVersions} onselect={openTrace} />
		{/key}
	{:else}<p role="alert">{t('kindHistory.unavailable')}</p>{/if}
</section>
