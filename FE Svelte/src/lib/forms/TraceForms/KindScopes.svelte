<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { Scope } from '$lib/state/triplit/types';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import { ScopeChip, ScopePicker, scopeAncestors, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import type { MembershipIntent } from './types';

	let {
		scopes,
		value,
		onchange
	}: {
		scopes: readonly Scope[];
		value: MembershipIntent;
		onchange: (next: MembershipIntent) => void;
	} = $props();
	const options = $derived(scopeOptionsOf(scopes, workbench.view.intersections));
	const nameOf = (id: string): string => scopes.find((scope) => scope.id === id)?.name ?? id;
	const add = (id: string | null): void => {
		if (!id || value.scopeIds.includes(id)) return;
		onchange({ scopeIds: [...value.scopeIds, id], explicit: true });
	};
	const remove = (id: string): void =>
		onchange({ scopeIds: value.scopeIds.filter((entry) => entry !== id), explicit: true });
</script>

<!-- The Kind's own direct memberships (core/trace-scope): zero, one or many, chosen here and
     nowhere else, the way a record chooses its Scopes — a picker and chips, never the whole
     catalog as checkboxes. What the user did not touch is not sent; taking the last chip away
     is the explicit choice of no Scope. -->
<div class="grid gap-2" data-testid="kind-scopes">
	<ScopePicker
		scopes={options}
		exclude={value.scopeIds}
		label={t('kind.scopes')}
		placeholder={t('draft.scopeAdd')}
		onpick={add}
	/>
	{#if value.scopeIds.length}
		<ul class="flex flex-wrap items-center gap-1" aria-label={t('kind.scopes')}>
			{#each value.scopeIds as id (id)}
				<li class="max-w-full min-w-0">
					<ScopeChip
						{id}
						name={nameOf(id)}
						path={scopeAncestors(options, id)}
						removeLabel={t('draft.scopeRemove', { name: nameOf(id) })}
						onremove={() => remove(id)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>
