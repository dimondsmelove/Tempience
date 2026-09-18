<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { Scope } from '$lib/state/triplit/types';
	import Button from '$lib/ui/Button/Button.svelte';
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
	const explicitNone = $derived(value.explicit && value.scopeIds.length === 0);
	const available = $derived(scopes.filter((scope) => !value.scopeIds.includes(scope.id)));
	const nameOf = (id: string): string => scopes.find((scope) => it(scope, id))?.name ?? id;
	const it = (scope: Scope, id: string): boolean => scope.id === id;
	const add = (id: string): void => {
		if (!id || value.scopeIds.includes(id)) return;
		onchange({ scopeIds: [...value.scopeIds, id], explicit: true });
	};
	const remove = (id: string): void =>
		onchange({ scopeIds: value.scopeIds.filter((entry) => entry !== id), explicit: true });
</script>

<!-- The Kind's own direct memberships (core/trace-scope): zero, one or many, chosen here and
     nowhere else, the way a record chooses its Scopes — a picker and chips, never the whole
     catalog as checkboxes. What the user did not touch is not sent; «Без Scope» is a choice. -->
<div class="grid gap-2" data-testid="kind-scopes">
	<select
		class="cg-control cg-field"
		aria-label={t('kind.scopes')}
		value=""
		onchange={(event) => {
			add(event.currentTarget.value);
			event.currentTarget.value = '';
		}}
	>
		<option value="">{t('draft.scopeAdd')}</option>
		{#each available as scope (scope.id)}
			<option value={scope.id}>{scope.name}</option>
		{/each}
	</select>
	<div class="flex flex-wrap items-center gap-1">
		{#each value.scopeIds as id (id)}
			<Button
				size="sm"
				aria-label={t('draft.scopeRemove', { name: nameOf(id) })}
				onclick={() => remove(id)}
			>
				<span class="min-w-0 truncate">{nameOf(id)}</span><span aria-hidden="true">×</span>
			</Button>
		{/each}
		<Button
			size="sm"
			variant="quiet"
			pressed={explicitNone}
			data-testid="kind-no-scope"
			onclick={() => onchange({ scopeIds: [], explicit: true })}>{t('kind.noScope')}</Button
		>
	</div>
</div>
