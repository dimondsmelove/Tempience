<script lang="ts">
	import { Tooltip } from 'flowbite-svelte';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { minutesLabel } from '../PracticeDemo/format';
	import type { PracticeTooltipProps } from './types';
	import './PracticeTooltip.css';

	let {
		triggerId,
		bucket,
		activities,
		label,
		weeklyMinutes,
		partial = false
	}: PracticeTooltipProps = $props();
	const rows = $derived(
		activities
			.map((activity) => ({
				...activity,
				value: bucket.slices.find((slice) => slice.activityId === activity.id)
			}))
			.filter((activity) => activity.value && activity.value.minutes > 0)
	);
</script>

<Tooltip
	id={`${triggerId}-tooltip`}
	triggeredBy={`#${triggerId}`}
	placement="top"
	strategy="fixed"
	triggerDelay={80}
	arrow={false}
	class="practice-tooltip"
>
	<div class="practice-tooltip-heading">
		<strong>{label}</strong>{#if partial}<span>{t('practice.inProgress')}</span>{/if}
	</div>
	<div class="practice-tooltip-total">
		<strong>{minutesLabel(bucket.minutes, locale.current)}</strong><span
			>{t('practice.sessionsCount', { count: bucket.sessions })}</span
		>
	</div>
	{#if rows.length}
		<ul class="practice-tooltip-activities">
			{#each rows as row (row.id)}
				<li style:--activity-color={row.color ?? 'var(--cg-text-muted)'}>
					<span
						class={['practice-swatch', !row.color && 'practice-swatch-uncoloured']}
						aria-hidden="true"
					></span>
					<span>{row.name}</span>
					<strong>{minutesLabel(row.value!.minutes, locale.current)}</strong>
					<span class="practice-tooltip-share"
						>{Math.round((row.value!.minutes / bucket.minutes) * 100)}%</span
					>
				</li>
			{/each}
		</ul>
		<p class="practice-tooltip-caption">{t('practice.shareHint')}</p>
	{:else}<p class="practice-tooltip-caption">{t('practice.empty')}</p>{/if}
	{#if weeklyMinutes !== undefined}
		<div class="practice-tooltip-goal">
			<span>{t('practice.actualGoal')}</span><strong
				>{minutesLabel(bucket.minutes, locale.current)} / {minutesLabel(
					weeklyMinutes,
					locale.current
				)}</strong
			>
		</div>
		<p class="practice-tooltip-caption">
			{t('practice.goalPercent', { percent: Math.round((bucket.minutes / weeklyMinutes) * 100) })}
		</p>
	{/if}
</Tooltip>
