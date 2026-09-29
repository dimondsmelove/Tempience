<script lang="ts">
	import { CloseOutline } from 'flowbite-svelte-icons';
	import type { ComponentProps } from '@sjsf/form';
	import { idMapper, multipleOptions } from '@sjsf/form/options.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { ScopePicker } from '$lib/ui/ScopePicker';

	let {
		handlers,
		config,
		value = $bindable(),
		options,
		mapped = multipleOptions({
			mapper: () => idMapper(options),
			value: () => value,
			update: (next) => (value = next)
		})
	}: ComponentProps['checkboxesWidget'] = $props();
	/** An option's key in `mapped`: what the checkboxes of SJSF bind to. */
	const keyOf = (option: (typeof options)[number]): string => option.mappedValue ?? option.id;
	const choices = $derived(
		options
			.filter((option) => !option.disabled)
			.map((option) => ({ id: keyOf(option), name: option.label, parentId: null }))
	);
	const chosen = $derived(options.filter((option) => mapped.current.includes(keyOf(option))));
	const set = (next: string[]): void => {
		mapped.current = next;
		handlers.oninput?.();
		handlers.onchange?.();
	};
	const add = (key: string | null): void => {
		if (key && !mapped.current.includes(key)) set([...mapped.current, key]);
	};
	const remove = (key: string): void => set(mapped.current.filter((entry) => entry !== key));
</script>

<!-- «Несколько вариантов»: a list to pick from and the chosen ones as chips, the way a record
     picks its Scopes — never every option as a checkbox (owner, 2026-09-28). Chips keep the
     order of the Kind's options. -->
<div class="grid min-w-0 gap-2" data-testid="choices-widget">
	<ScopePicker
		scopes={choices}
		exclude={mapped.current}
		label={config.title || t('choices.add')}
		placeholder={t('choices.add')}
		searchLabel={t('choices.search')}
		disabled={config.schema.readOnly === true}
		onpick={add}
	/>
	{#if chosen.length}
		<ul class="flex flex-wrap items-center gap-1" aria-label={config.title}>
			{#each chosen as option (option.id)}
				<li
					class="choice-chip inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-[var(--cg-radius-control)] border py-0.5 pr-0.5 pl-1.5 text-xs text-ink"
				>
					<span class="min-w-0 truncate">{option.label}</span>
					<button
						type="button"
						class="inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-[var(--cg-radius-control)] text-muted hover:bg-accent/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
						aria-label={t('choices.remove', { name: option.label })}
						title={t('choices.remove', { name: option.label })}
						onclick={() => remove(keyOf(option))}><CloseOutline class="h-3 w-3" /></button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.choice-chip {
		background: var(--cg-bg-raised);
		border-color: var(--cg-border-default);
	}
</style>
