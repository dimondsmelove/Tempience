<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import type { PracticeChartActivity } from '../PracticeDemo/types';
	import PracticeBudgets from './PracticeBudgets.svelte';
	import PracticeSourceSettings from './PracticeSourceSettings.svelte';

	let {
		id,
		practice,
		sourceValid,
		activities,
		week,
		onsave,
		onclose
	}: {
		id: string;
		practice: PracticeState;
		sourceValid: boolean;
		activities: readonly PracticeChartActivity[];
		week: string;
		onsave: (id: string, minutes: number | null) => Promise<void>;
		onclose: () => void;
	} = $props();
</script>

<!-- Settings, not the page itself (owner, 2026-10-28): the source and the weekly budgets open
     from «Настройки»; the base view is the directions, the totals and the charts. -->
<section
	{id}
	class="practice-settings"
	aria-labelledby={`${id}-title`}
	data-testid="practice-settings"
>
	<div class="practice-settings-head">
		<h2 id={`${id}-title`}>{t('practice.settings')}</h2>
		{#if sourceValid}<button type="button" class="cg-control" onclick={onclose}
				>{t('practice.settingsDone')}</button
			>{/if}
	</div>
	<PracticeSourceSettings {practice} />
	{#if sourceValid}<PracticeBudgets {activities} {week} {onsave} />{/if}
</section>
