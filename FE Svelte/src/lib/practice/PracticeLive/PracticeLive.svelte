<script lang="ts">
	import { resolve } from '$app/paths';
	import { onDestroy } from 'svelte';
	import { CogOutline } from 'flowbite-svelte-icons';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColourOf } from '$lib/theme/scope-colour';
	import {
		practiceSettingsRepository,
		practiceTargetsRepository,
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
	} from '$lib/practice/PracticeDemo/model';
	import { dateLabel, minutesLabel } from '$lib/practice/PracticeDemo/format';
	import type { PracticePeriod } from '$lib/practice/PracticeDemo/types';
	import type { PracticeDashboardData } from '$lib/state/Practice/types';
	import { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import PracticeEditor from './PracticeEditor.svelte';
	import PracticeRecords from './PracticeRecords.svelte';
	import { liveDirections, liveHistory, selectionGoal, selectionRemaining } from './live';
	import PracticeSettings from './PracticeSettings.svelte';
	import '$lib/practice/PracticeDemo/PracticeDemo.css';
	import '$lib/practice/PracticeDemo/PracticeRecords.css';
	import './PracticeLive.css';

	const practice = new PracticeState(
		tempienceRepository,
		practiceSettingsRepository,
		practiceTargetsRepository
	);
	const stop = practice.start();
	onDestroy(stop);
	let period = $state<PracticePeriod>('week');
	let anchor = $state(practice.today);
	let activityId = $state<string | null>(null);
	let recordError = $state<unknown>(null);
	let editor = $state<{ key: number; entry: DraftEntry } | null>(null);
	let editorKey = 0;
	const settingsId = $props.id();
	let settingsOpen = $state(false);

	const sourceValid = $derived(
		practice.validSource &&
			!!practice.source &&
			practice.source.scopeIds.length > 0 &&
			practice.source.scopeIds.every((id) =>
				practice.scopes.some((scope) => scope.id === id && !scope.isDeleted)
			)
	);
	const data: PracticeDashboardData = $derived(practice.data);
	const activities = $derived(
		data.activities.map((item) => ({
			...item,
			color: scopeColourOf(item.colour, appearance.scopeBase)
		}))
	);
	const range = $derived(periodRange(period, anchor));
	const selected = $derived(entriesIn(data.entries, range, activityId, data.kindId));
	const total = $derived(totalMinutes(selected));
	const goalOf = (id: string, date: string): number | null => practice.targetFor(id, date);
	const ids = $derived(activities.map((item) => item.id));
	const rows = $derived(
		liveDirections(activities, data.entries, data.kindId, period, range, goalOf)
	);
	const shown = $derived(rows.filter((row) => !activityId || row.id === activityId));
	const goal = $derived(
		period === 'week' ? selectionGoal(activityId ? [activityId] : ids, range.start, goalOf) : null
	);
	const remaining = $derived(goal === null ? null : selectionRemaining(shown));
	const goalsSet = $derived(activities.filter((item) => item.weeklyMinutes !== null).length);
	const buckets = $derived(activityBuckets(selected, period, range, ids));
	const history = $derived(
		liveHistory(data.entries, data.today, activityId, data.kindId, ids, goalOf)
	);
	const saveTarget = (scopeId: string, minutesPerWeek: number | null): Promise<unknown> =>
		practiceTargetsRepository.setWeeklyTarget({ scopeId, minutesPerWeek });
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
			activityId && source.scopeIds.includes(activityId)
				? [activityId]
				: source.scopeIds.length === 1
					? source.scopeIds
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
						onclick={() => (settingsOpen = !settingsOpen)}
						><CogOutline class="h-4 w-4" aria-hidden="true" />{t('practice.settings')}</button
					>{/if}
				<a class="practice-back cg-control" href={resolve('/practice/demo')}
					>{t('practice.demo')} ↗</a
				>
			</div>
		</header>
		{#if editor}
			{#key editor.key}<PracticeEditor
					entry={editor.entry}
					tracked={activities}
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
					{activities}
					week={periodRange('week', data.today).start}
					onsave={async (id, minutes) => void (await saveTarget(id, minutes))}
					onclose={() => (settingsOpen = false)}
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
							disabled={range.end > data.today}
							onclick={() => (anchor = adjacentPeriod(period, anchor, 1))}>›</button
						><button class="cg-control" onclick={() => (anchor = data.today)}
							>{t('practice.today')}</button
						>
					</div>
				</div>
				{#if goalsSet < activities.length}<p class="practice-norms-status" role="note">
						{t(goalsSet ? 'practice.someNorms' : 'practice.noNorms')}
					</p>{/if}
				<section class="practice-summary" aria-label={t('practice.summary')}>
					<div class="practice-summary-main">
						<p>{t('practice.invested')}</p>
						<strong data-testid="practice-total">{minutesLabel(total, locale.current)}</strong><span
							>{goal === null
								? t('practice.inPeriod')
								: t('practice.ofGoal', { goal: minutesLabel(goal, locale.current) })}</span
						>
					</div>
					{#if remaining !== null}<div>
							<p>{t('practice.remaining')}</p>
							<strong data-testid="practice-remaining"
								>{minutesLabel(remaining, locale.current)}</strong
							><span>{goal ? `${Math.round((total / goal) * 100)}%` : ''}</span>
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
					activities={activities.filter((item) => !activityId || item.id === activityId)}
					onday={openDay}
					onweek={openWeek}
				/>
				{#if recordError}<p role="alert">{errorText(recordError)}</p>{/if}
				<PracticeRecords {practice} {records} {activities} onedit={edit} onremove={remove} />
			{/if}
		{/if}
	</div>
</div>
