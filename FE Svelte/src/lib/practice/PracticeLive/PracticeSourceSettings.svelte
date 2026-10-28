<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { practiceSettingsRepository } from '$lib/state/triplit';
	import type { PracticeState } from '$lib/state/Practice/Practice.svelte';
	import type { PracticeSource } from '$lib/state/triplit/PracticeSettings/types';
	import { practiceFields } from '$lib/state/triplit/PracticeSettings/source';

	let { practice }: { practice: PracticeState } = $props();
	let selectedKindId = $state('');
	let selectedPath = $state('');
	let selectedScopes = $state<string[]>([]);
	let scopeEdited = $state(false);
	let saving = $state(false);
	let failure = $state<unknown>(null);

	const kindId = $derived(selectedKindId || practice.source?.kindId || '');
	const kind = $derived(practice.kinds.find((row) => row.id === kindId && !row.isDeleted));
	const version = $derived(practice.versions.find((row) => row.id === kind?.currentKindVId));
	const fields = $derived(version ? practiceFields(version) : []);
	const path = $derived(
		selectedPath || (practice.source?.kindId === kindId ? JSON.stringify(practice.source.path) : '')
	);
	const scopeIds = $derived(scopeEdited ? selectedScopes : (practice.source?.scopeIds ?? []));
	const sourceNeedsRepair = $derived(
		!!practice.source &&
			(!practice.validSource ||
				!practice.source.scopeIds.length ||
				practice.source.scopeIds.some(
					(id) => !practice.scopes.some((scope) => scope.id === id && !scope.isDeleted)
				))
	);
	const saveSource = async (): Promise<void> => {
		if (!kindId || !path || !scopeIds.length) return;
		saving = true;
		failure = null;
		try {
			const source: PracticeSource = {
				id: 'source',
				kindId,
				path: JSON.parse(path) as string[],
				scopeIds
			};
			await practiceSettingsRepository.setPracticeSource(source);
			selectedKindId = '';
			selectedPath = '';
			selectedScopes = [];
			scopeEdited = false;
		} catch (cause) {
			failure = cause;
		} finally {
			saving = false;
		}
	};
</script>

<section class="practice-panel" aria-labelledby="practice-source-title">
	<h2 id="practice-source-title">{t('practice.sourceSettings')}</h2>
	<p>{t('practice.sourceHelp')}</p>
	<div class="practice-source-form">
		<label>
			{t('practice.kind')}
			<select
				class="cg-control cg-field"
				value={kindId}
				onchange={(event) => {
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
				onchange={(event) => (selectedPath = event.currentTarget.value)}
			>
				<option value="">{t('practice.chooseField')}</option>
				{#each fields as field (JSON.stringify(field.path))}
					<option value={JSON.stringify(field.path)}>{field.label}</option>
				{/each}
			</select>
		</label>
		<fieldset>
			<legend>{t('practice.trackedScopes')}</legend>
			{#each practice.scopes.filter((scope) => !scope.isDeleted || scopeIds.includes(scope.id)) as scope (scope.id)}
				<label>
					<input
						type="checkbox"
						checked={scopeIds.includes(scope.id)}
						onchange={(event) => {
							scopeEdited = true;
							selectedScopes = event.currentTarget.checked
								? [...scopeIds, scope.id]
								: scopeIds.filter((id) => id !== scope.id);
						}}
					/>{scope.name}{scope.isDeleted ? ` (${t('practice.deletedScope')})` : ''}
				</label>
			{/each}
		</fieldset>
		<button
			type="button"
			class="cg-control"
			disabled={saving || !kindId || !path || !scopeIds.length}
			onclick={saveSource}>{saving ? t('practice.saving') : t('practice.saveSource')}</button
		>
	</div>
	{#if failure}<p role="alert">{errorText(failure)}</p>{/if}
	{#if sourceNeedsRepair}
		<p role="alert">{t('practice.sourceNeedsRepair')}</p>
	{/if}
</section>
