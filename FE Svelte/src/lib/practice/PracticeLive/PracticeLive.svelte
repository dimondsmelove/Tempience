<script lang="ts">
	import { onDestroy } from 'svelte';
	import { CogOutline } from 'flowbite-svelte-icons';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColourOf } from '$lib/theme/scope-colour';
	import {
		practiceSettingsRepository,
		practiceWeekPlansRepository,
		tempienceRepository
	} from '$lib/state/triplit';
	import { errorText } from '$lib/state/Locale/errors';
	import type { DraftEntry } from '$lib/state/TraceDraft/types';
	import PracticeCharts from '$lib/practice/PracticeCharts/PracticeCharts.svelte';
	import PracticeDirections from '$lib/practice/PracticeDirections/PracticeDirections.svelte';
	import {
		addDays,
		activityBuckets,
		adjacentPeriod,
		entriesIn,
		periodRange,
		totalMinutes
	} from '$lib/model/Practice/model';
	import { dateLabel, minutesLabel } from '$lib/model/Practice/format';
	import type { PracticePeriod } from '$lib/model/Practice/types';
	import type { PracticeDashboardData } from '$lib/state/Practice/types';
	import { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import PracticeEditor from './PracticeEditor.svelte';
	import PracticeRecords from './PracticeRecords.svelte';
	import {
		historyActivityIds,
		rangeActivityIds,
		liveDirections,
		liveHistory,
		selectionGoal,
		selectionRemaining
	} from './live';
	import PracticeSettings from './PracticeSettings.svelte';
	import '$lib/practice/PracticeLive/PracticeRecords.css';
	import './PracticeLive.css';

	const practice = new PracticeState(
		tempienceRepository,
		practiceSettingsRepository,
		practiceWeekPlansRepository
	);
	const stop = practice.start();
	onDestroy(stop);
	let settingsDirty = $state(false);
	const toggleSettings = (): void => {
		if (settingsOpen && settingsDirty && !window.confirm(t('practice.discardSettings'))) return;
		settingsOpen = !settingsOpen;
		settingsDirty = false;
	};
	let period = $state<PracticePeriod>('week');
	let anchor = $state(practice.today);
	let activityId = $state<string | null>(null);
	let recordError = $state<unknown>(null);
	let editor = $state<{ key: number; entry: DraftEntry } | null>(null);
	let editorKey = 0;
	const settingsId = $props.id();
	let settingsOpen = $state(false);

	const sourceValid = $derived(practice.validSource && !!practice.source);
	const data: PracticeDashboardData = $derived(practice.data);
	const allActivities = $derived(
		data.activities.map((item) => ({
			...item,
			color: scopeColourOf(item.colour, appearance.scopeBase)
		}))
	);
	const weekPlan = $derived(practice.planFor(periodRange('week', anchor).start));
	const range = $derived(periodRange(period, anchor));
	const selected = $derived(entriesIn(data.entries, range, activityId, data.kindId));
	const trackedActivities = $derived(allActivities);
	const visibleIds = $derived(
		new Set(rangeActivityIds(data.entries, range, data.kindId, weekPlan?.scopeIds ?? []))
	);
	const activities = $derived(allActivities.filter((item) => visibleIds.has(item.id)));
	const total = $derived(totalMinutes(selected));
	const goalOf = (id: string, date: string): number | null =>
		practice.targetFor(id, periodRange('week', date).start);
	const ids = $derived(weekPlan?.scopeIds ?? []);
	const plannedOf = (id: string, date: string): boolean =>
		practice.planFor(periodRange('week', date).start)?.scopeIds.includes(id) ?? false;
	const plannedTotal = $derived(
		totalMinutes(selected.filter((entry) => entry.scopeIds.some((id) => plannedOf(id, entry.date))))
	);
	const unplannedTotal = $derived(total - plannedTotal);
	const rows = $derived(
		liveDirections(activities, data.entries, data.kindId, period, range, goalOf, plannedOf)
	);
	const shown = $derived(
		rows.filter(
			(row) =>
				(!activityId || row.id === activityId) && (weekPlan?.scopeIds.includes(row.id) ?? false)
		)
	);
	const goal = $derived(
		period === 'week' ? selectionGoal(activityId ? [activityId] : ids, range.start, goalOf) : null
	);
	const remaining = $derived(goal === null ? null : selectionRemaining(shown));
	const buckets = $derived(
		activityBuckets(
			selected,
			period,
			range,
			activities.map((item) => item.id)
		)
	);
	const historyIds = $derived(
		historyActivityIds(
			data.entries,
			data.today,
			data.kindId,
			allActivities.map((item) => item.id),
			(week) => practice.planFor(week)?.scopeIds ?? []
		)
	);
	const historyActivities = $derived(allActivities.filter((item) => historyIds.includes(item.id)));
	const history = $derived(
		liveHistory(
			data.entries,
			anchor,
			activityId,
			data.kindId,
			historyIds,
			goalOf,
			(date) => practice.planFor(date)?.scopeIds ?? []
		)
	);
	const savePlan = (
		week: string,
		scopeIds: readonly string[],
		goals: Readonly<Record<string, number>>
	) => practiceWeekPlansRepository.savePracticeWeekPlan(week, { scopeIds, goals });
	const selection = $derived(
		activities.find((item) => item.id === activityId)?.name ?? t('practice.allActivities')
	);
	const rangeLabel = $derived(
		period === 'day'
			? dateLabel(anchor, locale.current, { day: 'numeric', month: 'long', year: 'numeric' })
			: period === 'month'
				? dateLabel(range.start, locale.current, { month: 'long', year: 'numeric' })
				: `${dateLabel(range.start, locale.current)} — ${dateLabel(addDays(range.end, -1), locale.current)}`
	);
	const records = $derived(
		[...selected].sort((a, b) => b.date.localeCompare(a.date) || (b.hour ?? -1) - (a.hour ?? -1))
	);
	const edit = (id: string): void => {
		editor = { key: ++editorKey, entry: { mode: 'edit', traceId: id } };
	};
	const create = (): void => {
		const source = practice.source;
		if (!sourceValid || !source) return;
		const initialScopes =
			activityId && trackedActivities.some((item) => item.id === activityId)
				? [activityId]
				: weekPlan?.scopeIds.length === 1
					? [weekPlan.scopeIds[0]]
					: [];
		editor = {
			key: ++editorKey,
			entry: { mode: 'create', kindId: source.kindId, scopeIds: initialScopes }
		};
	};
	const remove = async (id: string): Promise<void> => {
		recordError = null;
		try {
			await tempienceRepository.setTraceDeleted(id, true, 'user');
		} catch (cause) {
			recordError = cause;
		}
	};
	const openDay = (date: string): void => {
		anchor = date;
		period = 'day';
	};
	const openWeek = (date: string): void => {
		anchor = date;
		period = 'week';
	};
</script>

<svelte:head><title>{t('practice.title')} · Tempience</title></svelte:head>

<div class="practice-scroll" data-testid="practice-live">
	<div class="practice-page">
		<header class="practice-heading">
			<div>
				<p class="practice-eyebrow">{t('practice.eyebrow')}</p>
				<h1>{t('practice.title')}</h1>
				<p class="practice-subtitle">{t('practice.subtitle')}</p>
			</div>
			<div class="practice-heading-actions">
				{#if sourceValid}<button
						type="button"
						class="practice-back cg-control"
						aria-expanded={settingsOpen}
						aria-controls={settingsId}
						data-testid="practice-settings-toggle"
						onclick={toggleSettings}
						><CogOutline class="h-4 w-4" aria-hidden="true" />{t('practice.settings')}</button
					>{/if}
			</div>
		</header>
		{#if editor}
			{#key editor.key}<PracticeEditor
					entry={editor.entry}
					tracked={trackedActivities}
					onclose={() => (editor = null)}
				/>{/key}
		{/if}
		{#if practice.loading}<p role="status">{t('practice.loading')}</p>
		{:else if practice.failure}<p role="alert">
				{t('practice.readError', { message: errorText(practice.failure) })}
			</p>
		{:else}
			{#if settingsOpen}
				<PracticeSettings
					id={settingsId}
					{practice}
					{sourceValid}
					activities={trackedActivities}
					week={periodRange('week', anchor).start}
					onsave={async (week, scopeIds, goals) => void (await savePlan(week, scopeIds, goals))}
					ondirty={(dirty) => (settingsDirty = dirty)}
					onclose={toggleSettings}
				/>
			{:else if !sourceValid}
				<section class="practice-empty" data-testid="practice-empty">
					<p>{t(practice.source ? 'practice.setupRepair' : 'practice.setupEmpty')}</p>
					<button
						type="button"
						class="cg-control"
						aria-controls={settingsId}
						aria-expanded="false"
						data-testid="practice-setup"
						onclick={() => (settingsOpen = true)}>{t('practice.setup')}</button
					>
				</section>
			{/if}
			{#if sourceValid}
				<div class="practice-controls">
					<div class="practice-periods" role="group" aria-label={t('practice.period')}>
						{#each ['day', 'week', 'month'] as option (option)}<button
								type="button"
								class="cg-control"
								aria-pressed={period === option}
								onclick={() => (period = option as PracticePeriod)}
								>{t(
									option === 'day'
										? 'practice.day'
										: option === 'week'
											? 'practice.week'
											: 'practice.month'
								)}</button
							>{/each}
					</div>
					<div class="practice-calendar">
						<button
							class="cg-control"
							aria-label={t('practice.previous')}
							onclick={() => (anchor = adjacentPeriod(period, anchor, -1))}>‹</button
						><span class="practice-range">{rangeLabel}</span><button
							class="cg-control"
							aria-label={t('practice.next')}
							onclick={() => (anchor = adjacentPeriod(period, anchor, 1))}>›</button
						><button class="cg-control" onclick={() => (anchor = data.today)}
							>{t('practice.today')}</button
						>
					</div>
				</div>
				{#if !weekPlan}<p class="practice-norms-status" role="note">
						{t('practice.emptyWeekPlan')}
					</p>{/if}
				<section class="practice-summary" aria-label={t('practice.summary')}>
					<div class="practice-summary-main">
						<p>{t('practice.invested')}</p>
						<strong data-testid="practice-total">{minutesLabel(total, locale.current)}</strong><span
							>{goal === null
								? t('practice.inPeriod')
								: t('practice.plannedOfGoal', {
										minutes: minutesLabel(plannedTotal, locale.current),
										goal: minutesLabel(goal, locale.current)
									})}</span
						>
					</div>
					{#if unplannedTotal > 0}<div>
							<p>{t('practice.unplanned')}</p>
							<strong data-testid="practice-unplanned"
								>{minutesLabel(unplannedTotal, locale.current)}</strong
							><span>{t('practice.withoutPlan')}</span>
						</div>{/if}
					{#if remaining !== null}<div>
							<p>{t('practice.remaining')}</p>
							<strong data-testid="practice-remaining"
								>{minutesLabel(remaining, locale.current)}</strong
							><span>{goal ? `${Math.round((plannedTotal / goal) * 100)}%` : ''}</span>
						</div>{/if}
					<div>
						<p>{t('practice.sessions')}</p>
						<strong>{selected.length}</strong><span>{t('practice.fromKind')}</span>
					</div>
					<div>
						<p>{t('practice.activeDays')}</p>
						<strong>{new Set(selected.map((entry) => entry.date)).size}</strong><span
							>{t('practice.consistency')}</span
						>
					</div>
				</section>
				<div class="practice-selection">
					<label for="practice-activity-filter">{t('practice.viewing')}</label><select
						id="practice-activity-filter"
						class="cg-control cg-control-sm practice-activity-filter"
						value={activityId ?? ''}
						onchange={(event) => (activityId = event.currentTarget.value || null)}
						><option value="">{t('practice.allActivities')}</option
						>{#each activities as item (item.id)}<option value={item.id}>{item.name}</option
							>{/each}</select
					><button type="button" class="cg-control" onclick={create}
						>{t('practice.addRecord')}</button
					>
				</div>
				<PracticeDirections
					{rows}
					{period}
					{activityId}
					onselect={(id) => (activityId = activityId === id ? null : id)}
				/>
				<PracticeCharts
					{buckets}
					{history}
					{period}
					weeklyMinutes={goal}
					{selection}
					today={data.today}
					activities={historyActivities.filter((item) => !activityId || item.id === activityId)}
					onday={openDay}
					onweek={openWeek}
				/>
				{#if recordError}<p role="alert">{errorText(recordError)}</p>{/if}
				<PracticeRecords {practice} {records} {activities} onedit={edit} onremove={remove} />
			{/if}
		{/if}
	</div>
</div>
