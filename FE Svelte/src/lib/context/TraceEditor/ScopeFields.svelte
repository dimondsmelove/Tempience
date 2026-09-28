<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeField from '$lib/ui/ScopeField/ScopeField.svelte';
	import { scopeOptionsOf } from '$lib/ui/ScopePicker';
	import { PlusOutline } from 'flowbite-svelte-icons';

	let { draft }: { draft: TraceDraftState } = $props();
	// The draft's own catalog names the Scopes; the timeline's links give them their tree.
	const options = $derived(scopeOptionsOf(draft.scopeList, workbench.view.intersections));
	const scopeOf = (id: string) => draft.scopeList.find((scope) => scope.id === id);
</script>

<!-- Memberships of the record itself: the entry's, the Kind's and the user's own choices.
     A missing Scope is created in a nested step of this same form and selected on return. -->
<div class="grid gap-2" data-testid="capture-scopes">
	<ScopeField
		label={t('draft.scopes')}
		{options}
		ids={draft.selectedScopeIds}
		scopeOf={(id) => scopeOf(id)}
		pickerLabel={t('draft.scopeChoose')}
		placeholder={t('draft.scopeAdd')}
		removeLabel={(name) => t('draft.scopeRemove', { name })}
		listLabel={t('draft.scopeSelected')}
		groups={workbench.chapters.captureGroups}
		onadd={(id) => draft.addScope(id)}
		onremove={(id) => draft.removeScope(id)}
	>
		{#snippet after()}
			<Button
				icon
				aria-label={t('draft.scopeNew')}
				title={t('draft.scopeNew')}
				data-testid="draft-scope-new"
				onclick={() => (draft.nested = 'scope')}><PlusOutline class="h-4 w-4" /></Button
			>
		{/snippet}
	</ScopeField>
</div>
