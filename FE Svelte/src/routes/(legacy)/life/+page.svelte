<script lang="ts">
	import { CodedError } from '$lib/model/Errors/CodedError';
	import { errorText } from '$lib/state/Locale/errors';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { tempienceRepository } from '$lib/state/triplit';
	import LifeGridView from '$lib/surfaces/life/LifeGridView.svelte';
	import LifePeriodPicker from '$lib/surfaces/life/LifePeriodPicker.svelte';
	import LifeScopeBar from '$lib/surfaces/life/LifeScopeBar.svelte';
	import LifeToolbar from '$lib/surfaces/life/LifeToolbar.svelte';
	import {
		buildLifeGrid,
		resolveCellAction,
		type LifeGridCell
	} from '$lib/surfaces/life/life-grid';
	import { defaultLifePeriod } from '$lib/surfaces/life/navigation';
	import {
		filledKeysForWeeks,
		scopeWeekStarts,
		buildLocalLifeProjection,
		type LocalLifeProjection
	} from '$lib/surfaces/life/triplit-projection';
	import {
		hasLifeUrlParams,
		lifeView,
		lifeViewState,
		updateLifeView
	} from '$lib/surfaces/life/life-view.svelte';

	let loading = $state(true);
	let failure = $state.raw<unknown>(null);
	let projection = $state<LocalLifeProjection | null>(null);

	const fallbackPeriod = defaultLifePeriod(new Date().toISOString().slice(0, 10));
	const period = $derived(lifeViewState.period);
	const scale = $derived(lifeViewState.scale);
	const scopeFocus = $derived(lifeViewState.scope);
	const scopeIncludeFuture = $derived(lifeView.scopeIncludeFuture);

	const gridRows = $derived(
		projection ? buildLifeGrid(scale, projection.weeks, period, locale.current) : []
	);
	const visibleWeekCount = $derived(projection?.weeks.length ?? 0);
	const traceFilled = $derived(
		projection ? filledKeysForWeeks(projection.traceWeekStarts, scale) : new Set<string>()
	);
	const focusedScopeWeeks = $derived(
		projection && scopeFocus
			? scopeWeekStarts(projection, scopeFocus.id, scopeIncludeFuture)
			: new Set<string>()
	);
	const scopeFilled = $derived(filledKeysForWeeks(focusedScopeWeeks, scale));
	const scopeFilledCount = $derived(focusedScopeWeeks.size);
	const traceFilledCount = $derived(projection?.traceWeekStarts.size ?? 0);

	const loadProjection = async (signal: AbortSignal): Promise<void> => {
		const [traces, scopes, segments] = await Promise.all([
			tempienceRepository.listTraces(),
			tempienceRepository.listScopes(),
			tempienceRepository.listScopeSegments()
		]);
		if (signal.aborted) return;
		projection = buildLocalLifeProjection(period, traces, scopes, segments);
	};

	onMount(() => {
		if (hasLifeUrlParams($page.url.searchParams)) {
			lifeViewState.hydrateFromUrl($page.url.searchParams, fallbackPeriod);
			lifeViewState.stripUrl();
		}
	});

	$effect(() => {
		const periodSnapshot = { ...period };
		const controller = new AbortController();
		let offlineBootstrapShown = false;
		loading = true;
		failure = null;

		// Render the empty local grid if IndexedDB/sync initialization is slow; late reads still replace it.
		const fallbackTimer = setTimeout(() => {
			if (controller.signal.aborted) return;
			offlineBootstrapShown = true;
			projection = buildLocalLifeProjection(periodSnapshot, [], [], []);
			loading = false;
		}, 3000);

		void loadProjection(controller.signal)
			.catch((cause: unknown) => {
				if (controller.signal.aborted || offlineBootstrapShown) return;
				failure = cause ?? new CodedError('life_projection', 'the life map could not be built');
				projection = null;
			})
			.finally(() => {
				clearTimeout(fallbackTimer);
				if (!controller.signal.aborted && !offlineBootstrapShown) loading = false;
			});

		return () => {
			clearTimeout(fallbackTimer);
			controller.abort();
		};
	});

	const handleCellClick = (cell: LifeGridCell): void => {
		const input = resolveCellAction(cell, scale);
		if (!input) return;
		updateLifeView({ period: input, scale: input.scale ?? scale });
	};
</script>

<div class="flex h-full min-h-0 flex-col gap-4 px-4 py-4 sm:px-6">
	<LifeToolbar {projection} />

	{#if loading}
		<p class="text-muted" role="status">{t('life.loading')}</p>
	{:else if failure !== null}
		<p class="cg-panel border-danger text-danger" role="alert">{errorText(failure)}</p>
	{:else if projection}
		<LifePeriodPicker />
		<LifeScopeBar scopes={projection.scopes} scopeWeekCount={scopeFilledCount} {visibleWeekCount} />

		<div class="flex flex-wrap items-center gap-2 text-sm">
			<span class="text-muted">{t('life.weeksInPeriod', { count: visibleWeekCount })}</span>
			<span class="text-accent">{t('life.weeksWithRecords', { count: traceFilledCount })}</span>
			{#if scopeFocus}
				<span class="text-warning">{t('life.weeksInScope', { count: scopeFilledCount })}</span>
			{/if}
		</div>

		<LifeGridView
			rows={gridRows}
			{scale}
			{traceFilled}
			{scopeFilled}
			scopeActive={Boolean(scopeFocus)}
			onCellClick={handleCellClick}
		/>
	{/if}
</div>
