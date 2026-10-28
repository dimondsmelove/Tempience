<script lang="ts">
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { minutesLabel } from '../PracticeDemo/format';
	import { remainingMinutes, sortDirections } from '../PracticeDemo/model';
	import type { PracticeSort } from '../PracticeDemo/types';
	import type { PracticeDirectionsProps } from './types';
	let { rows, period, activityId, onselect }: PracticeDirectionsProps = $props();
	const hasGoals = $derived(rows.some((row) => row.weeklyMinutes !== null));
	const goalOf = (row: { weeklyMinutes: number | null }): boolean =>
		period === 'week' && row.weeklyMinutes !== null;
	let order = $state<PracticeSort>('original');
	const sorted = $derived(sortDirections(rows, period, order));
</script>

<section class="practice-activities" aria-labelledby="practice-activities-title">
	<div class="practice-section-heading">
		<div>
			<h2 id="practice-activities-title">{t('practice.activities')}</h2>
			<p>{t('practice.selectHint')}</p>
		</div>
		<label class="practice-sort">
			<span>{t('practice.sort')}</span>
			<select
				class="cg-control cg-control-sm"
				value={order}
				onchange={(event) => (order = event.currentTarget.value as PracticeSort)}
			>
				<option value="original">{t('practice.sortOriginal')}</option>
				<option value="ascending"
					>{t(
						period === 'week' && hasGoals ? 'practice.sortLeast' : 'practice.sortLessTime'
					)}</option
				>
				<option value="descending"
					>{t(
						period === 'week' && hasGoals ? 'practice.sortMost' : 'practice.sortMoreTime'
					)}</option
				>
			</select>
		</label>
	</div>
	<div class="practice-activity-list">
		{#each sorted as row (row.id)}
			<button
				type="button"
				class={[
					'practice-activity',
					activityId === row.id && 'practice-activity-selected',
					!row.color && 'practice-activity-uncoloured'
				]}
				style:--activity-color={row.color ?? 'var(--cg-text-muted)'}
				aria-pressed={activityId === row.id}
				data-activity={row.id}
				onclick={() => onselect(row.id)}
			>
				<span class="practice-activity-name"
					><i
						class={['practice-swatch', !row.color && 'practice-swatch-uncoloured']}
						aria-hidden="true"
					></i>{row.name}<span aria-hidden="true">↗</span></span
				>
				<span class="practice-activity-amount"
					>{minutesLabel(row.minutes, locale.current)}{#if goalOf(row)}<span>
							/ {minutesLabel(row.weeklyMinutes!, locale.current)}</span
						>{:else if period === 'week' && hasGoals}<span>
							· {t('practice.noGoal')}</span
						>{/if}</span
				>
				<span class="practice-progress-track" aria-hidden="true"
					>{#if Math.min(100, goalOf(row) ? row.percent : row.share) > 0}<span
							style:width={`${Math.min(100, goalOf(row) ? row.percent : row.share)}%`}
						></span>{/if}</span
				>
				<span class="practice-activity-status"
					>{#if goalOf(row)}{#if row.percent >= 100}<span class="practice-reached"
								>✓ {row.percent}%</span
							>{:else}{row.percent}% · {t('practice.remainingShort', {
								minutes: minutesLabel(
									remainingMinutes(row.minutes, row.weeklyMinutes!),
									locale.current
								)
							})}{/if}{:else}{t('practice.sessionsCount', {
							count: row.sessions
						})}{/if}</span
				>
			</button>
		{/each}
	</div>
	<p class="practice-activity-note">
		{t(period === 'week' && hasGoals ? 'practice.minimumHint' : 'practice.noDailyGoal')}
	</p>
</section>
