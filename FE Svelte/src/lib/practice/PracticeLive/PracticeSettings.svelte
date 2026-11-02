<script lang="ts">
	import { scopeOptionsOf } from '$lib/ui/ScopePicker/tree';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import type { PracticeChartActivity } from '../../model/Practice/types';
	import PracticeWeekPlanEditor from './PracticeWeekPlanEditor.svelte';
	import PracticeSourceSettings from './PracticeSourceSettings.svelte';

	let {
		id,
		practice,
		sourceValid,
		activities,
		week,
		onsave,
		ondirty,
		onclose
	}: {
		id: string;
		practice: PracticeState;
		sourceValid: boolean;
		activities: readonly PracticeChartActivity[];
		week: string;
		onsave: (
			week: string,
			scopeIds: readonly string[],
			goals: Readonly<Record<string, number>>
		) => Promise<void>;
		ondirty: (dirty: boolean) => void;
		onclose: () => void;
	} = $props();
	let sourceDirty = false;
	let planDirty = false;
	const setDirty = (section: 'source' | 'plan', dirty: boolean): void => {
		if (section === 'source') sourceDirty = dirty;
		else planDirty = dirty;
		ondirty(sourceDirty || planDirty);
	};
</script>

<!-- Settings, not the page itself (owner, 2026-10-28): the source and the weekly plans open
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
				>{t('practice.settingsClose')}</button
			>{/if}
	</div>
	<PracticeSourceSettings {practice} ondirty={(dirty) => setDirty('source', dirty)} />
	{#if sourceValid}
		{#key week}
			<PracticeWeekPlanEditor
				{activities}
				scopes={scopeOptionsOf(
					activities,
					practice.links.filter((link) => !link.isDeleted)
				)}
				{week}
				plan={practice.planFor(week)}
				{onsave}
				ondirty={(dirty) => setDirty('plan', dirty)}
			/>
		{/key}
	{/if}
</section>
