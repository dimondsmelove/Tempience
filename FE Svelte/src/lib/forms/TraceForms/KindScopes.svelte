<script lang="ts">
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { Scope } from '$lib/state/triplit/types';
	import { workbench } from '$lib/state/Workbench/instance.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { ScopePicker, scopeAncestors, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import type { MembershipIntent } from './types';

	let {
		scopes,
		value,
		onchange,
		onnew
	}: {
		scopes: readonly Scope[];
		value: MembershipIntent;
		onchange: (next: MembershipIntent) => void;
		/** The «+» beside the picker: a Scope that does not exist yet, made in a nested step and chosen on return. */
		onnew?: () => void;
	} = $props();
	const options = $derived(scopeOptionsOf(scopes, workbench.view.intersections));
	const scopeOf = (id: string): Scope | undefined => scopes.find((scope) => scope.id === id);
	const nameOf = (id: string): string => scopeOf(id)?.name ?? id;
	const add = (id: string | null): void => {
		if (!id || value.scopeIds.includes(id)) return;
		onchange({ scopeIds: [...value.scopeIds, id], explicit: true });
	};
	const remove = (id: string): void =>
		onchange({ scopeIds: value.scopeIds.filter((entry) => entry !== id), explicit: true });
</script>

<!-- The Kind's own direct memberships (core/trace-scope): zero, one or many, chosen here and
     nowhere else, the way a record chooses its Scopes — a picker with the «+» of a new Scope
     beside it (the record form's `ScopeFields` pattern; owner review 2026-09-19, pack 4, C) and
     chips, never the whole catalog as checkboxes. What the user did not touch is not sent;
     taking the last chip away is the explicit choice of no Scope. -->
<div class="grid gap-2" data-testid="kind-scopes">
	<div class="flex items-center gap-1">
		<ScopePicker
			scopes={options}
			exclude={value.scopeIds}
			label={t('kind.scopes')}
			placeholder={t('draft.scopeAdd')}
			class="min-w-0 flex-1"
			onpick={add}
		/>
		{#if onnew}
			<Button
				icon
				aria-label={t('draft.scopeNew')}
				title={t('draft.scopeNew')}
				data-testid="kind-scope-new"
				onclick={onnew}><PlusOutline class="h-4 w-4" /></Button
			>
		{/if}
	</div>
	{#if value.scopeIds.length}
		<ul class="flex flex-wrap items-center gap-1" aria-label={t('kind.scopes')}>
			{#each value.scopeIds as id (id)}
				<li class="max-w-full min-w-0">
					<ScopeChip
						{id}
						name={nameOf(id)}
						colorHue={scopeOf(id)?.colorHue ?? null}
						colorChroma={scopeOf(id)?.colorChroma ?? null}
						colorDepth={scopeOf(id)?.colorDepth ?? null}
						path={scopeAncestors(options, id)}
						removeLabel={t('draft.scopeRemove', { name: nameOf(id) })}
						onremove={() => remove(id)}
					/>
				</li>
			{/each}
		</ul>
	{/if}
</div>
