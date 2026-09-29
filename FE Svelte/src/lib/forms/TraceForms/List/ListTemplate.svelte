<script lang="ts">
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { getComponent, getFormContext, type ComponentProps } from '@sjsf/form';
	import { getArrayContext } from '@sjsf/form/fields/array/context.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { compactColumns, inlineFieldTitle, inlineItems, listVariants } from './list';

	const { children, uiOption, config, errors, value }: ComponentProps['arrayTemplate'] = $props();
	const ctx = getFormContext();
	const list = getArrayContext();
	const ErrorsList = $derived(getComponent(ctx, 'errorsList', config));
	const id = $props.id();
	const title = $derived(uiOption('title') ?? config.title);
	const inline = $derived(inlineItems(config.schema));
	const variants = $derived(listVariants(config.schema));
	/** The variants already in the record: each is offered once. */
	const used = $derived(
		new Set(
			(Array.isArray(value) ? value : []).map((row) =>
				variants && row && typeof row === 'object' && !Array.isArray(row)
					? (row as Record<string, unknown>)[variants.key]
					: undefined
			)
		)
	);
	const fieldTitle = $derived(inlineFieldTitle(config.schema, config.uiSchema));
	const columns = $derived(compactColumns(config.schema, config.uiSchema));
	/** A row of the pressed variant, added at the end: the order is the order things were done. */
	const addVariant = (value: string): void => {
		if (!variants) return;
		list.pushItem();
		list.set(list.length() - 1, { [variants.key]: value });
	};
</script>

<!-- A list of a typed record (loop 013, Q7): its name, then its rows — values in a line when a
     row is one value, cards otherwise — and one «+» to add a row. SJSF keeps the data; this
     template only lays it out. -->
<div
	class="trace-list grid min-w-0 gap-1.5"
	role="group"
	aria-labelledby={`${id}-title`}
	data-inline={inline}
	data-testid="trace-list"
>
	<span id={`${id}-title`} class="text-sm" data-role="list-title">{title}</span>
	{#if fieldTitle}<span class="-mt-1 text-xs text-muted" data-role="list-field">{fieldTitle}</span
		>{/if}
	{#if columns && list.length()}
		<!-- The columns are named once above the rows, which then hold only values. -->
		<div class="compact-head text-xs text-muted" style:--cols={columns.length} aria-hidden="true">
			{#each columns as column, n (n)}<span class="truncate">{column}</span>{/each}
		</div>
	{/if}
	<div
		class={[
			'min-w-0',
			inline ? 'flex flex-wrap items-center gap-1.5' : columns ? 'grid gap-1' : 'grid gap-2'
		]}
	>
		{@render children()}
		{#if inline && list.canAdd()}
			<Button
				size="sm"
				icon
				aria-label={t('list.add', { name: fieldTitle ?? title })}
				title={t('list.add', { name: fieldTitle ?? title })}
				onclick={list.pushItem}><PlusOutline class="h-3.5 w-3.5" /></Button
			>
		{/if}
	</div>
	{#if variants && list.canAdd()}
		<!-- One control adds a variant (owner, 2026-09-29): a list to pick from, each variant
		     once — another set of it is added inside its own row. -->
		<select
			class="cg-control cg-field add-variant"
			aria-label={t('list.add', { name: title })}
			data-testid="trace-list-variant-add"
			value=""
			onchange={(event) => {
				const chosen = event.currentTarget.value;
				event.currentTarget.value = '';
				if (chosen) addVariant(chosen);
			}}
		>
			<option value="">{t('list.addVariant', { name: variants.title.toLocaleLowerCase() })}</option>
			{#each variants.options as option (option.value)}<option
					value={option.value}
					disabled={used.has(option.value)}>{option.title}</option
				>{/each}
		</select>
	{:else if columns && list.canAdd()}
		<Button
			class="justify-self-start"
			size="sm"
			icon
			aria-label={t('list.add', { name: title })}
			title={t('list.add', { name: title })}
			onclick={list.pushItem}><PlusOutline class="h-3.5 w-3.5" /></Button
		>
	{:else if !inline && list.canAdd()}
		<Button
			class="justify-self-start"
			size="sm"
			aria-label={t('list.add', { name: title })}
			onclick={list.pushItem}><PlusOutline class="h-3.5 w-3.5" aria-hidden="true" />{title}</Button
		>
	{/if}
	{#if errors.length > 0}<ErrorsList {errors} {config} />{/if}
</div>

<style>
	.add-variant {
		justify-self: start;
		width: auto;
		max-width: 100%;
	}
	/* Column titles over compact rows: the same grid as a row, the last cell kept for its ×. */
	.compact-head {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr)) 1.75rem;
		gap: 0.375rem;
		padding: 0 0.125rem;
	}
</style>
