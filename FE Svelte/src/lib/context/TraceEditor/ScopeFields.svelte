<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { TraceDraftState } from '$lib/state/TraceDraft/TraceDraft.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { PlusOutline } from 'flowbite-svelte-icons';

	let { draft }: { draft: TraceDraftState } = $props();
	const available = $derived(
		draft.scopeList.filter((scope) => !draft.selectedScopeIds.includes(scope.id))
	);
	const nameOf = (id: string): string =>
		draft.scopeList.find((scope) => scope.id === id)?.name ?? t('draft.scopeUnavailable');
</script>

<!-- Memberships of the record itself: the entry's, the Kind's and the user's own choices.
     A missing Scope is created in a nested step of this same form and selected on return. -->
<div class="grid gap-2" data-testid="capture-scopes">
	<div class="grid gap-1 text-sm">
		<span id="draft-scopes-label">{t('draft.scopes')}</span>
		<div class="flex items-center gap-1">
			<select
				class="cg-control cg-field min-w-0 flex-1"
				aria-label={t('draft.scopeChoose')}
				value=""
				onchange={(event) => {
					draft.addScope(event.currentTarget.value);
					event.currentTarget.value = '';
				}}
			>
				<option value="">{t('draft.scopeAdd')}</option>
				{#each available as scope (scope.id)}
					<option value={scope.id}>{scope.name}</option>
				{/each}
			</select>
			<Button
				size="sm"
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
				<li>
					<Button
						size="sm"
						aria-label={t('draft.scopeRemove', { name })}
						onclick={() => draft.removeScope(id)}
					>
						<span class="min-w-0 truncate">{name}</span><span aria-hidden="true">×</span>
					</Button>
				</li>
			{/each}
		</ul>
	{/if}
</div>
