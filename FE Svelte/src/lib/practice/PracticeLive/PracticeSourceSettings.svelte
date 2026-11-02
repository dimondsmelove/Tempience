<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { practiceSettingsRepository } from '$lib/state/triplit';
	import type { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import type { PracticeSource } from '$lib/state/triplit/PracticeSettings/types';
	import { practiceFields } from '$lib/state/triplit/PracticeSettings/source';

	let { practice, ondirty }: { practice: PracticeState; ondirty: (dirty: boolean) => void } =
		$props();
	let selectedKindId = $state('');
	let selectedPath = $state('');
	let saving = $state(false);
	let failure = $state<unknown>(null);

	const kindId = $derived(selectedKindId || practice.source?.kindId || '');
	const kind = $derived(practice.kinds.find((row) => row.id === kindId && !row.isDeleted));
	const version = $derived(practice.versions.find((row) => row.id === kind?.currentKindVId));
	const fields = $derived(version ? practiceFields(version) : []);
	const path = $derived(
		selectedPath || (practice.source?.kindId === kindId ? JSON.stringify(practice.source.path) : '')
	);
	const sourceNeedsRepair = $derived(!!practice.source && !practice.validSource);
	const saveSource = async (): Promise<void> => {
		if (!kindId || !path) return;
		saving = true;
		failure = null;
		try {
			const source: PracticeSource = {
				id: 'source',
				kindId,
				path: JSON.parse(path) as string[],
				scopeIds: practice.source?.scopeIds ?? []
			};
			await practiceSettingsRepository.setPracticeSource(source);
			ondirty(false);
			selectedKindId = '';
			selectedPath = '';
		} catch (cause) {
			failure = cause;
		} finally {
			saving = false;
		}
	};
</script>

<details class="practice-panel practice-source-details" open={!practice.validSource}>
	<summary>{t('practice.sourceSettings')}</summary>
	<p>{t('practice.sourceHelp')}</p>
	<div class="practice-source-form">
		<label>
			{t('practice.kind')}
			<select
				class="cg-control cg-field"
				value={kindId}
				onchange={(event) => {
					ondirty(true);
					selectedKindId = event.currentTarget.value;
					selectedPath = '';
				}}
			>
				<option value="">{t('practice.chooseKind')}</option>
				{#each practice.kinds.filter((row) => !row.isDeleted) as row (row.id)}
					<option value={row.id}>{row.name}</option>
				{/each}
			</select>
		</label>
		<label>
			{t('practice.minutesField')}
			<select
				class="cg-control cg-field"
				value={path}
				onchange={(event) => {
					ondirty(true);
					selectedPath = event.currentTarget.value;
				}}
			>
				<option value="">{t('practice.chooseField')}</option>
				{#each fields as field (JSON.stringify(field.path))}
					<option value={JSON.stringify(field.path)}>{field.label}</option>
				{/each}
			</select>
		</label>

		<button
			type="button"
			class="cg-control"
			disabled={saving || !kindId || !path}
			onclick={saveSource}>{saving ? t('practice.saving') : t('practice.saveSource')}</button
		>
	</div>
	{#if failure}<p role="alert">{errorText(failure)}</p>{/if}
	{#if sourceNeedsRepair}
		<p role="alert">{t('practice.sourceNeedsRepair')}</p>
	{/if}
</details>
