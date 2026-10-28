<script lang="ts">
	import { resolve } from '$app/paths';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import PracticeCharts from '../PracticeCharts/PracticeCharts.svelte';
	import PracticeDirections from '../PracticeDirections/PracticeDirections.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColourOf } from '$lib/theme/scope-colour';
	import { DEMO_ACTIVITIES, DEMO_START, DEMO_TODAY, PRACTICE_PERIODS } from './constants';
	import { demoEntries } from './fixture';
	import { dateLabel, minutesLabel } from './format';
	import {
		activityBuckets,
		addDays,
		adjacentPeriod,
		entriesIn,
		periodRange,
		remainingMinutes,
		totalMinutes,
		weekHistory
	} from './model';
	import type { PracticePeriod } from './types';
	import './PracticeDemo.css';
	import './PracticeRecords.css';

	const entries = demoEntries();
	let period = $state<PracticePeriod>('week');
	let anchor = $state(DEMO_TODAY);
	let activityId = $state<string | null>(null);
	const range = $derived(periodRange(period, anchor));
	const selected = $derived(entriesIn(entries, range, activityId));
	const total = $derived(totalMinutes(selected));
	const activity = $derived(DEMO_ACTIVITIES.find((item) => item.id === activityId));
	const selection = $derived(activity?.name ?? t('practice.allActivities'));
	const weeklyMinutes = $derived(
		activity?.weeklyMinutes ?? DEMO_ACTIVITIES.reduce((sum, item) => sum + item.weeklyMinutes, 0)
	);
	const activities = $derived(
		DEMO_ACTIVITIES.map((item) => ({
			...item,
			color: scopeColourOf(item.colour, appearance.scopeBase)
		}))
	);
	const chartActivities = $derived(
		activities.filter((item) => !activityId || item.id === activityId)
	);
	const periodTotal = $derived(totalMinutes(entriesIn(entries, range)));
	const rows = $derived(
		activities.map((item) => {
			const records = entriesIn(entries, range, item.id);
			const minutes = totalMinutes(records);
			return {
				...item,
				minutes,
				sessions: records.length,
				percent: Math.round((minutes / item.weeklyMinutes) * 100),
				share: periodTotal ? (minutes / periodTotal) * 100 : 0
			};
		})
	);
	const remaining = $derived(
		rows
			.filter((item) => !activityId || item.id === activityId)
			.reduce((sum, item) => sum + remainingMinutes(item.minutes, item.weeklyMinutes), 0)
	);
	const reached = $derived(rows.filter((item) => item.minutes >= item.weeklyMinutes).length);
	const activeDays = $derived(new Set(selected.map((entry) => entry.date)).size);
	const buckets = $derived(activityBuckets(selected, period, range));
	const history = $derived(weekHistory(entries, DEMO_TODAY, activityId));
	const records = $derived(
		[...selected].sort((a, b) => b.date.localeCompare(a.date) || (b.hour ?? -1) - (a.hour ?? -1))
	);
	const rangeLabel = $derived(
		period === 'day'
			? dateLabel(anchor, locale.current, { day: 'numeric', month: 'long', year: 'numeric' })
			: period === 'month'
				? dateLabel(range.start, locale.current, { month: 'long', year: 'numeric' })
				: `${dateLabel(range.start, locale.current)} — ${dateLabel(addDays(range.end, -1), locale.current)}`
	);
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

<div class="practice-scroll" data-testid="practice-demo">
	<div class="practice-page">
		<div class="practice-demo-notice" role="note">
			<span class="practice-demo-dot" aria-hidden="true"></span>
			<strong>{t('practice.demo')}</strong>
			<span>{t('practice.demoNotice')}</span>
		</div>

		<header class="practice-heading">
			<div>
				<p class="practice-eyebrow">{t('practice.eyebrow')}</p>
				<h1>{t('practice.title')}</h1>
				<p class="practice-subtitle">{t('practice.subtitle')}</p>
			</div>
			<a class="practice-back cg-control" href={resolve('/')}
				>{t('practice.back')} <span aria-hidden="true">↗</span></a
			>
		</header>

		<div class="practice-controls">
			<div class="practice-periods" role="group" aria-label={t('practice.period')}>
				{#each PRACTICE_PERIODS as option (option)}
					<Button size="sm" pressed={period === option} onclick={() => (period = option)}
						>{t(`practice.${option}`)}</Button
					>
				{/each}
			</div>
			<div class="practice-calendar">
				<Button
					size="sm"
					icon
					aria-label={t('practice.previous')}
					disabled={range.start <= DEMO_START}
					onclick={() => (anchor = adjacentPeriod(period, anchor, -1))}>‹</Button
				>
				<span class="practice-range" aria-live="polite" data-testid="practice-range"
					>{rangeLabel}</span
				>
				<Button
					size="sm"
					icon
					aria-label={t('practice.next')}
					disabled={range.end > DEMO_TODAY}
					onclick={() => (anchor = adjacentPeriod(period, anchor, 1))}>›</Button
				>
				<Button size="sm" onclick={() => (anchor = DEMO_TODAY)}>{t('practice.today')}</Button>
			</div>
		</div>

		<section class="practice-summary" aria-label={t('practice.summary')}>
			<div class="practice-summary-main">
				<p>{t('practice.invested')}</p>
				<strong data-testid="practice-total">{minutesLabel(total, locale.current)}</strong>
				<span
					>{period === 'week'
						? t('practice.ofGoal', { goal: minutesLabel(weeklyMinutes, locale.current) })
						: t('practice.inPeriod')}</span
				>
			</div>
			<div>
				<p>{t(period === 'week' ? 'practice.remaining' : 'practice.sessions')}</p>
				<strong
					>{period === 'week' ? minutesLabel(remaining, locale.current) : selected.length}</strong
				>
				<span
					>{t(
						period === 'week'
							? remaining === 0
								? 'practice.goalReached'
								: 'practice.toWeeklyGoal'
							: 'practice.fromKind'
					)}</span
				>
			</div>
			<div>
				<p>
					{t(
						period === 'week'
							? activityId
								? 'practice.weeklyProgress'
								: 'practice.goalReached'
							: 'practice.activeDays'
					)}
				</p>
				<strong
					>{period === 'week'
						? activityId
							? `${Math.round((total / weeklyMinutes) * 100)}%`
							: `${reached} / ${rows.length}`
						: activeDays}</strong
				>
				<span
					>{period === 'week' && !activityId
						? t('practice.activitiesReached', { count: reached, total: rows.length })
						: t('practice.consistency')}</span
				>
			</div>
		</section>

		<PracticeDirections
			{rows}
			{period}
			{activityId}
			onselect={(id) => (activityId = activityId === id ? null : id)}
		/>

		<div class="practice-selection">
			<label for="practice-activity-filter">{t('practice.viewing')}</label>
			<select
				id="practice-activity-filter"
				class="cg-control cg-control-sm practice-activity-filter"
				value={activityId ?? ''}
				onchange={(event) => (activityId = event.currentTarget.value || null)}
			>
				<option value="">{t('practice.allActivities')}</option>
				{#each DEMO_ACTIVITIES as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
			</select>
			{#if activityId}<button type="button" onclick={() => (activityId = null)}
					>{t('practice.resetFilter')} <span aria-hidden="true">×</span></button
				>{/if}
		</div>

		<PracticeCharts
			{buckets}
			today={DEMO_TODAY}
			{history}
			{period}
			{weeklyMinutes}
			{selection}
			activities={chartActivities}
			onday={openDay}
			onweek={openWeek}
		/>

		<details class="practice-records" data-testid="practice-records">
			<summary
				><span>{t('practice.records')}</span><span class="practice-record-count"
					>{records.length}</span
				><span class="practice-record-toggle" aria-hidden="true">⌄</span></summary
			>
			<p class="practice-record-source">{t('practice.source')}</p>
			{#if records.length}
				<div class="practice-record-list">
					{#each records as entry (entry.id)}
						<div class="practice-record">
							<time datetime={entry.date}>{dateLabel(entry.date, locale.current)}</time>
							<div>
								<strong
									>{DEMO_ACTIVITIES.find((item) => entry.scopeIds.includes(item.id))?.name}</strong
								>
								<p>{entry.note}</p>
							</div>
							<span>{minutesLabel(entry.data.minutes, locale.current)}</span>
						</div>
					{/each}
				</div>
			{:else}<p class="practice-empty">{t('practice.empty')}</p>{/if}
		</details>
		<footer class="practice-footer">
			<span
				>{t('practice.fixtureDate', {
					date: dateLabel(DEMO_TODAY, locale.current, {
						day: 'numeric',
						month: 'long',
						year: 'numeric'
					})
				})}</span
			><span>{t('practice.footer')}</span>
		</footer>
	</div>
</div>
