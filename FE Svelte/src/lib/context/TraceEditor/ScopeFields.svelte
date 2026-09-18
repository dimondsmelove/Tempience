<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { ScopeChip, ScopePicker, scopeAncestors, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import { PlusOutline } from 'flowbite-svelte-icons';

	let { draft }: { draft: TraceDraftState } = $props();
	// The draft's own catalog names the Scopes; the timeline's links give them their tree.
	const options = $derived(scopeOptionsOf(draft.scopeList, workbench.view.intersections));
	const nameOf = (id: string): string =>
		draft.scopeList.find((scope) => scope.id === id)?.name ?? t('draft.scopeUnavailable');
</script>

<!-- Memberships of the record itself: the entry's, the Kind's and the user's own choices.
     A missing Scope is created in a nested step of this same form and selected on return. -->
<div class="grid gap-2" data-testid="capture-scopes">
	<div class="grid gap-1 text-sm">
		<span id="draft-scopes-label">{t('draft.scopes')}</span>
		<div class="flex items-center gap-1">
			<ScopePicker
				scopes={options}
				exclude={draft.selectedScopeIds}
				label={t('draft.scopeChoose')}
				placeholder={t('draft.scopeAdd')}
				class="min-w-0 flex-1"
				onpick={(id) => {
					if (id) draft.addScope(id);
				}}
			/>
			<Button
				icon
				aria-label={t('draft.scopeNew')}
				title={t('draft.scopeNew')}
				data-testid="draft-scope-new"
				onclick={() => (draft.nested = 'scope')}><PlusOutline class="h-4 w-4" /></Button
			>
		</div>
	</div>
	{#if draft.selectedScopeIds.length}
		<ul class="flex flex-wrap gap-1" aria-label={t('draft.scopeSelected')}>
			{#each draft.selectedScopeIds as id (id)}
				{@const name = nameOf(id)}
				<li class="max-w-full min-w-0">
					<ScopeChip
						{id}
						{name}
						path={scopeAncestors(options, id)}
						removeLabel={t('draft.scopeRemove', { name })}
						onremove={() => draft.removeScope(id)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>
