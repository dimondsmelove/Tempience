<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';

	import { dateLabel, minutesLabel } from '../PracticeDemo/format';
	import { addDays, periodRange } from '../PracticeDemo/model';
	import PracticeTooltip from '../PracticeTooltip/PracticeTooltip.svelte';
	import type { PracticeBucket } from '../PracticeDemo/types';
	import type { PracticeChartsProps } from './types';
	import './PracticeCharts.css';

	let {
		buckets,
		history,
		period,
		weeklyMinutes,
		selection,
		today,
		activities,
		onday,
		onweek
	}: PracticeChartsProps = $props();
	const maximum = $derived(Math.max(60, ...buckets.map((bucket) => bucket.minutes)));
	/** The goal of a history week: its own when the history carries goals, else the shared one. */
	const goalOf = (week: PracticeBucket): number | null =>
		week.goal !== undefined ? week.goal : weeklyMinutes;
	const goals = $derived(history.map(goalOf));
	const hasGoal = $derived(goals.some((goal) => goal !== null));
	const historyMaximum = $derived(
		Math.max(60, ...goals.map((goal) => goal ?? 0), ...history.map((week) => week.minutes)) * 1.15
	);
	/** Each week's goal as its own step, so a change shows from the week it applies to. */
	const goalSteps = $derived(
		goals.flatMap((goal, index) =>
			goal === null
				? []
				: [{ id: history[index].id, x1: x(index) - 39.75, x2: x(index) + 39.75, goal }]
		)
	);
	const y = (minutes: number): number => 160 - (minutes / historyMaximum) * 140;
	const x = (index: number): number => (index + 0.5) * 79.5;
	const points = $derived(
		history
			.slice(0, -1)
			.map((week, index) => `${x(index)},${y(week.minutes)}`)
			.join(' ')
	);
	const latest = $derived(
		history
			.slice(-2)
			.map((week, index) => `${x(index + 6)},${y(week.minutes)}`)
			.join(' ')
	);
	const layers = $derived(
		activities.map((activity, index) => {
			const lower = history.map((week) =>
				activities
					.slice(0, index)
					.reduce(
						(sum, item) =>
							sum + (week.slices.find((slice) => slice.activityId === item.id)?.minutes ?? 0),
						0
					)
			);
			const upper = history.map(
				(week, i) =>
					lower[i] + (week.slices.find((slice) => slice.activityId === activity.id)?.minutes ?? 0)
			);
			return {
				...activity,
				points: [
					...upper.map((minutes, i) => `${x(i)},${y(minutes)}`),
					...lower.map((minutes, i) => `${x(i)},${y(minutes)}`).reverse()
				].join(' ')
			};
		})
	);
	const bucketLabel = (bucket: PracticeBucket): string =>
		bucket.hour === undefined && period === 'day'
			? t('practice.noClockTime')
			: bucket.hour === undefined
				? dateLabel(
						bucket.date,
						locale.current,
						period === 'week' ? { weekday: 'short' } : { day: 'numeric' }
					)
				: `${String(bucket.hour).padStart(2, '0')}:00`;
	const tooltipLabel = (bucket: PracticeBucket): string =>
		`${dateLabel(bucket.date, locale.current)}${bucket.hour === undefined ? '' : ` · ${bucketLabel(bucket)}–${String(bucket.hour + 2).padStart(2, '0')}:00`}`;
</script>

<div class="practice-charts">
	<section class="practice-chart-panel" aria-labelledby="practice-distribution-title">
		<div class="practice-section-heading">
			<div>
				<h2 id="practice-distribution-title">
					{t(period === 'day' ? 'practice.inDay' : 'practice.byDay')}
				</h2>
				<p>{selection}</p>
			</div>
			<span class="practice-chart-unit">{minutesLabel(maximum, locale.current)}</span>
		</div>
		<div
			class={['practice-bars', period === 'month' && 'practice-bars-dense']}
			style:--bar-count={buckets.length}
		>
			{#each buckets as bucket, index (bucket.id)}
				{@const label = bucketLabel(bucket)}
				{@const future = bucket.date > today}
				{@const triggerId = `practice-bar-${bucket.id}`}
				<button
					id={triggerId}
					type="button"
					class={[
						'practice-bar-button',
						future && 'practice-future',
						bucket.date === today && 'practice-today'
					]}
					disabled={future && bucket.minutes === 0}
					aria-label={`${tooltipLabel(bucket)}: ${minutesLabel(bucket.minutes, locale.current)}`}
					onclick={() => {
						if (period !== 'day') onday(bucket.date);
					}}
				>
					<span class="practice-bar-track">
						{#if period === 'week' && bucket.minutes > 0}<span class="practice-bar-value"
								>{minutesLabel(bucket.minutes, locale.current)}</span
							>{/if}
						<span class="practice-bar-fill" style:height={`${(bucket.minutes / maximum) * 100}%`}>
							{#each activities as activity (activity.id)}
								{@const minutes =
									bucket.slices.find((slice) => slice.activityId === activity.id)?.minutes ?? 0}
								{#if minutes > 0}<span
										class={['practice-segment', !activity.color && 'practice-segment-uncoloured']}
										style:--activity-color={activity.color ?? 'var(--cg-text-muted)'}
										style:height={`${(minutes / bucket.minutes) * 100}%`}
										data-activity={activity.id}
									></span>{/if}
							{/each}
						</span>
					</span>
					<span
						class={[
							'practice-bar-label',
							period === 'day' && index % 2 === 1 && 'practice-bar-label-minor'
						]}
						>{#if period !== 'month' || index % 5 === 0 || index === buckets.length - 1}{label}{:else}<span
								aria-hidden="true">·</span
							>{/if}</span
					>
				</button>
				{#if !future}<PracticeTooltip
						{triggerId}
						{bucket}
						{activities}
						label={tooltipLabel(bucket)}
					/>{/if}
			{/each}
		</div>
		<p class="practice-chart-note">
			{t(period === 'day' ? 'practice.dayChartHint' : 'practice.dayChartAction')}
		</p>
	</section>

	<section class="practice-chart-panel" aria-labelledby="practice-history-title">
		<div class="practice-section-heading">
			<div>
				<h2 id="practice-history-title">{t('practice.history')}</h2>
				<p>{t('practice.eightWeeks')}</p>
			</div>
			{#if hasGoal}<span class="practice-goal-key"><span></span>{t('practice.weeklyGoal')}</span
				>{/if}
		</div>
		<div class="practice-history-stage">
			<svg
				class="practice-history-plot"
				viewBox="0 0 636 180"
				preserveAspectRatio="none"
				role="img"
				aria-label={t('practice.historyChart')}
			>
				<title>{t('practice.historyChart')}</title>
				<line x1="12" x2="624" y1="160" y2="160" class="practice-baseline" />
				{#each layers as layer (layer.id)}
					<polygon
						points={layer.points}
						class={['practice-history-area', !layer.color && 'practice-history-area-uncoloured']}
						style:--activity-color={layer.color ?? 'var(--cg-text-muted)'}
						data-activity={layer.id}
					/>
				{/each}
				{#each goalSteps as step (step.id)}<line
						x1={Math.max(12, step.x1)}
						x2={Math.min(624, step.x2)}
						y1={y(step.goal)}
						y2={y(step.goal)}
						class="practice-goal-line"
						data-goal={step.goal}
					/>{/each}
				<polyline {points} class="practice-history-line" />
				<polyline points={latest} class="practice-history-line practice-history-partial" />
				{#each history as week, index (week.id)}<circle
						cx={x(index)}
						cy={y(week.minutes)}
						r={index === 7 ? 6 : 4}
						class={index === 7 ? 'practice-current-point' : undefined}
					/>{/each}
			</svg>
			<div class="practice-history-triggers">
				{#each history as week (week.id)}
					{@const triggerId = `practice-history-${week.id}`}
					<button
						id={triggerId}
						type="button"
						onclick={() => onweek(week.date)}
						aria-label={`${dateLabel(week.date, locale.current)}: ${minutesLabel(week.minutes, locale.current)}`}
					>
						<span class="practice-history-label"
							><span
								>{dateLabel(week.date, locale.current, { day: 'numeric', month: 'numeric' })}</span
							><span class="practice-history-value"
								>{minutesLabel(week.minutes, locale.current)}</span
							></span
						>
					</button>
					<PracticeTooltip
						{triggerId}
						bucket={week}
						{activities}
						weeklyMinutes={goalOf(week) ?? undefined}
						partial={week.date === periodRange('week', today).start}
						label={`${dateLabel(week.date, locale.current)} — ${dateLabel(addDays(week.date, 6), locale.current)}`}
					/>
				{/each}
			</div>
		</div>
		<p class="practice-chart-note">{t('practice.partialWeek')}</p>
	</section>
</div>
<ul class="practice-chart-legend" aria-label={t('practice.activities')}>
	{#each activities as activity (activity.id)}
		<li style:--activity-color={activity.color ?? 'var(--cg-text-muted)'}>
			<span
				class={['practice-swatch', !activity.color && 'practice-swatch-uncoloured']}
				aria-hidden="true"
			></span>{activity.name}
		</li>
	{/each}
</ul>
