<script lang="ts">
	import { CloseOutline } from 'flowbite-svelte-icons';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { getLens, lensSource } from '$lib/ui/LensSource';
	import { chipTint } from './tint';
	import type { ScopeChipProps } from './types';

	type Named = Readonly<{ id: string; name: string }>;
	let {
		id,
		name,
		colorHue = null,
		colorChroma = null,
		colorDepth = null,
		path = [],
		onopen,
		openLabel,
		openTestId,
		onremove,
		removeLabel,
		removeTestId,
		testId,
		disabled = false,
		lit = false,
		lens,
		children
	}: ScopeChipProps = $props();
	const full = $derived([...path.map((scope) => scope.name), name].join(' › '));
	const tint = $derived(chipTint(colorHue, colorChroma, appearance.scopeBase, colorDepth));
	/** The workbench's hover, when the chip stands under one: every chip is a lens source (C3). */
	const hover = getLens();
	const target = $derived(lens === undefined ? { kind: 'scope' as const, scopeId: id } : lens);
</script>

{#snippet segment(scope: Named, leaf: boolean)}
	{#if onopen}
		<button
			type="button"
			class={[
				'min-w-0 cursor-pointer truncate py-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent',
				leaf ? 'text-ink' : 'text-muted'
			]}
			aria-label={leaf ? openLabel : undefined}
			data-testid={leaf ? openTestId : undefined}
			{disabled}
			onclick={() => onopen(scope.id)}>{scope.name}</button
		>
	{:else}<span class={['min-w-0 truncate py-0.5', !leaf && 'text-muted']}>{scope.name}</span>{/if}
{/snippet}

<!-- A Scope as one compact chip in the Scope's own colour (owner review 2026-09-19, п. 10/26):
     the whole chip is tinted, not a dot in it; the path reads muted, every name is a way there,
     the actions are small icons at the end. The inner padding is the same on both sides; with
     an icon at the end the icon's own room stands in for most of it (pack 3, P4). -->
<span
	class={[
		'scope-chip inline-flex max-w-full min-w-0 items-center rounded-[var(--cg-radius-control)] border pl-1.5 text-xs text-ink',
		children || onremove ? 'pr-0.5' : 'pr-1.5',
		lit && 'lit'
	]}
	style={tint}
	title={full}
	data-testid={testId}
	data-color-hue={colorHue ?? undefined}
	data-color-chroma={colorHue === null ? undefined : (colorChroma ?? undefined)}
	data-color-depth={colorHue === null ? undefined : (colorDepth ?? undefined)}
	data-lit={lit ? 'true' : undefined}
	{@attach lensSource(hover, target)}
>
	{#each path as scope (scope.id)}
		{@render segment(scope, false)}<span class="chip-sep text-muted" aria-hidden="true">›</span>
	{/each}
	{@render segment({ id, name }, true)}
	{#if children || onremove}<span class="chip-actions inline-flex shrink-0 items-center">
			{@render children?.()}
			{#if onremove}
				<button
					type="button"
					class="chip-icon inline-flex cursor-pointer items-center justify-center rounded-[var(--cg-radius-control)] text-muted hover:bg-accent/10 hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
					aria-label={removeLabel}
					title={removeLabel}
					data-testid={removeTestId}
					{disabled}
					onclick={onremove}><CloseOutline class="h-3 w-3" /></button
				>
			{/if}
		</span>{/if}
</span>

<style>
	/* The tint is the Scope's colour washed to two strengths; without a hue the chip
	   keeps the neutral surface and outline of every other chip. */
	.scope-chip {
		background: var(--chip-bg, var(--cg-bg-raised));
		border-color: var(--chip-border, var(--cg-border-default));
	}
	/* Hover linking (п. 26, reshaped in pack 3, P4): a 2 px accent underline with rounded ends,
	   the same one the linked record row carries — drawn over the chip's own bottom edge, so
	   nothing reflows. */
	.scope-chip.lit {
		position: relative;
	}
	.scope-chip.lit::after {
		content: '';
		position: absolute;
		left: 6px;
		right: 6px;
		bottom: -1px;
		height: 2px;
		border-radius: 1px;
		background: var(--cg-accent);
		pointer-events: none;
	}
	.chip-sep {
		margin-inline: 0.3em;
	}
	.chip-actions {
		margin-left: 0.2em;
	}
	.scope-chip :global(.chip-icon) {
		width: 1.125rem;
		height: 1.125rem;
	}
</style>
