<script lang="ts">
	import { ArrowDownOutline, ArrowUpOutline, CloseOutline } from 'flowbite-svelte-icons';
	import type { ComponentProps } from '@sjsf/form';
	import { getArrayContext } from '@sjsf/form/fields/array/context.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { compactColumns, inlineItems, listVariants } from './list';

	const { children, index, value }: ComponentProps['arrayItemTemplate'] = $props();
	const list = getArrayContext();
	const inline = $derived(inlineItems(list.config().schema));
	const columns = $derived(compactColumns(list.config().schema, list.config().uiSchema));
	const title = $derived(list.config().title);
	const n = $derived(index + 1);
	const variants = $derived(listVariants(list.config().schema));
	/** A row of variants is titled by its variant: «Бег», not «3». */
	const variant = $derived.by(() => {
		if (!variants || value === null || typeof value !== 'object' || Array.isArray(value))
			return null;
		const chosen = (value as Record<string, unknown>)[variants.key];
		return variants.options.find((option) => option.value === chosen)?.title ?? null;
	});
</script>

<!-- One row of a list: a value with its × when the row is one value, else a card whose
     controls stand on its top line. The field inside keeps its own label, visually hidden in a
     line of values, so every input stays named. -->
{#snippet controls()}
	{#if list.orderable() && list.length() > 1}
		<Button
			size="sm"
			variant="quiet"
			icon
			disabled={!list.canMoveUp(index)}
			aria-label={t('list.moveUp', { name: title, n })}
			title={t('list.moveUp', { name: title, n })}
			onclick={() => list.moveItemUp(index)}><ArrowUpOutline class="h-3.5 w-3.5" /></Button
		>
		<Button
			size="sm"
			variant="quiet"
			icon
			disabled={!list.canMoveDown(index)}
			aria-label={t('list.moveDown', { name: title, n })}
			title={t('list.moveDown', { name: title, n })}
			onclick={() => list.moveItemDown(index)}><ArrowDownOutline class="h-3.5 w-3.5" /></Button
		>
	{/if}
	{#if list.canRemove(index)}
		<Button
			size="sm"
			variant="quiet"
			icon
			aria-label={t('list.removeRow', { name: title, n })}
			title={t('list.removeRow', { name: title, n })}
			onclick={() => list.removeItem(index)}><CloseOutline class="h-3.5 w-3.5" /></Button
		>
	{/if}
{/snippet}

{#if inline}
	<div class="list-value inline-flex min-w-0 items-center" data-testid="trace-list-value">
		{@render children()}
		{#if list.canRemove(index)}
			<button
				type="button"
				class="list-remove"
				aria-label={t('list.removeValue', { name: title, n })}
				title={t('list.removeValue', { name: title, n })}
				onclick={() => list.removeItem(index)}><CloseOutline class="h-3 w-3" /></button
			>
		{/if}
	</div>
{:else if columns}
	<!-- A compact row: its values side by side under the list's column titles, and its ×. -->
	<div class="list-compact" style:--cols={columns.length} data-testid="trace-list-row">
		{@render children()}
		{#if list.canRemove(index)}
			<button
				type="button"
				class="list-remove"
				aria-label={t('list.removeRow', { name: title, n })}
				title={t('list.removeRow', { name: title, n })}
				onclick={() => list.removeItem(index)}><CloseOutline class="h-3.5 w-3.5" /></button
			>
		{/if}
	</div>
{:else if variant}
	<!-- A row of a variant is one line where it fits: its name, its values, its controls
	     (owner, 2026-09-29: «блок упражнения слишком большой»). -->
	<div class="variant-row" data-testid="trace-list-row">
		<span class="variant-title text-sm font-medium" data-testid="trace-list-row-title"
			>{variant}</span
		>
		<div class="variant-body min-w-0">{@render children()}</div>
		<div class="variant-controls flex items-center">{@render controls()}</div>
	</div>
{:else}
	<div
		class="list-row grid min-w-0 gap-2 rounded-[var(--cg-radius-surface)] border border-outline p-2"
		data-testid="trace-list-row"
	>
		<div class="flex items-center justify-end gap-1">{@render controls()}</div>
		{@render children()}
	</div>
{/if}

<style>
	.list-value {
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-control);
		background: var(--cg-bg-raised);
	}
	/* A value in a line is as wide as a few digits; its label stays for assistive technology. */
	/* Doubled: it outweighs the form's own input rule, whose :not() selectors count. */
	.list-value.list-value :global(input:not([type='checkbox']):not([type='radio'])) {
		width: 4.5rem;
		border: 0;
		background: transparent;
	}
	.list-value :global(label),
	.list-value :global(legend) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.list-compact {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 1.75rem;
		align-items: center;
		gap: 0.375rem;
	}
	/* Doubled: it outweighs the form's own grids and labels for these rows only. */
	.list-compact.list-compact :global([data-layout='object-properties']) {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		gap: 0.375rem;
	}
	.list-compact.list-compact :global([data-layout='field-meta']) {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	/* The name and the controls on one line, the values under them: a narrow panel never
	   pushes the controls onto a line of their own. */
	.variant-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'title controls' 'body body';
		align-items: center;
		gap: 0.25rem 0.5rem;
		padding: 0.375rem 0.5rem;
		border: 1px solid var(--cg-border-default);
		border-radius: var(--cg-radius-surface);
	}
	.variant-title {
		grid-area: title;
	}
	.variant-body {
		grid-area: body;
	}
	.variant-controls {
		grid-area: controls;
	}
	/* Inside a variant the row's name says what the values are: a list's own title and the
	   name of its one field stand down; the fields of the row stand side by side. */
	.variant-body :global([data-role='list-title']),
	.variant-body :global([data-role='list-field']) {
		display: none;
	}
	/* Only the row's own fields: a list of sets inside keeps its own columns. */
	.variant-body > :global([data-layout='object-field'] > [data-layout='object-properties']) {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem 0.75rem;
	}
	.variant-body
		> :global(
			[data-layout='object-field']
				> [data-layout='object-properties']
				> [data-layout='object-property']
		) {
		flex: 1 1 8rem;
		min-width: 0;
	}
	.list-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		align-self: stretch;
		padding: 0 0.25rem;
		border: 0;
		color: var(--cg-text-muted);
		background: transparent;
		cursor: pointer;
	}
	.list-remove:hover {
		color: var(--cg-text-primary);
	}
</style>
