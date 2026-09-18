<script lang="ts">
	import type { MessageKey } from '$lib/state/Locale/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import {
		calendarYearBounds,
		currentDecadePeriod,
		defaultLifePeriod,
		lastNYearsPeriod,
		type LifePeriod,
		type LifeScale
	} from './navigation';
	import { lifeViewState, updateLifeView } from './life-view.svelte';
	import type { LocalLifeProjection } from './triplit-projection';

	type Props = {
		projection: LocalLifeProjection | null;
	};

	let { projection }: Props = $props();

	const period = $derived(lifeViewState.period);
	const scale = $derived(lifeViewState.scale);
	const scope = $derived(lifeViewState.scope);
	const scopeIncludeFuture = $derived(lifeViewState.scopeIncludeFuture);
	const anchor = $derived(projection?.currentWeekStart ?? new Date().toISOString().slice(0, 10));

	const scales: { id: LifeScale; label: MessageKey }[] = [
		{ id: 'week', label: 'life.weeks' },
		{ id: 'month', label: 'life.months' },
		{ id: 'year', label: 'life.years' },
		{ id: 'decade', label: 'life.decades' }
	];

	const go = (nextPeriod: LifePeriod, nextScale: LifeScale = scale): void => {
		updateLifeView({ period: nextPeriod, scale: nextScale, scope, scopeIncludeFuture });
	};

	const setScale = (nextScale: LifeScale): void => updateLifeView({ scale: nextScale });

	const shiftYear = (delta: number): void => {
		const year = Number(period.from.slice(0, 4)) + delta;
		go(calendarYearBounds(year));
	};

	const applyPreset = (preset: 'year' | '5y' | 'decade'): void => {
		if (preset === 'year') {
			go(defaultLifePeriod(anchor));
			return;
		}
		if (preset === '5y') {
			go(lastNYearsPeriod(anchor, 5));
			return;
		}
		go(currentDecadePeriod(anchor));
	};
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Life</h1>
			<p class="text-sm text-muted">
				{period.from} — {period.to}
				{#if projection}
					{t('life.toolbarWeeks', { count: projection.weeks.length })}{/if}
			</p>
		</div>

		<div class="flex flex-wrap gap-1" role="group">
			<Button size="sm" onclick={() => shiftYear(-1)}>{t('life.previousYear')}</Button>
			<Button size="sm" onclick={() => applyPreset('year')}>{t('life.thisYear')}</Button>
			<Button size="sm" onclick={() => applyPreset('5y')}>{t('life.fiveYears')}</Button>
			<Button size="sm" onclick={() => applyPreset('decade')}>{t('life.decade')}</Button>
			<Button size="sm" onclick={() => shiftYear(1)}>{t('life.nextYear')}</Button>
		</div>
	</div>

	<div class="flex flex-wrap gap-1" role="group">
		{#each scales as item (item.id)}
			<Button size="sm" pressed={scale === item.id} onclick={() => setScale(item.id)}>
				{t(item.label)}
			</Button>
		{/each}
	</div>
</div>
