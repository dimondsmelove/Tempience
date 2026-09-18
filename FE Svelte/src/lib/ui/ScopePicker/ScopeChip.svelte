<script lang="ts">
	import type { Snippet } from 'svelte';
	import { CloseOutline } from 'flowbite-svelte-icons';

	type Named = Readonly<{ id: string; name: string }>;
	type Props = Readonly<{
		id: string;
		name: string;
		/** Ancestors, root first, shown muted before the name. */
		path?: readonly Named[];
		/** A chip that leads somewhere: every name in it, ancestors included, is a button. */
		onopen?: (scopeId: string) => void;
		openTestId?: string;
		/** A chip that can be taken away: a small × after the name. */
		onremove?: () => void;
		removeLabel?: string;
		removeTestId?: string;
		/** A test id on the chip as a whole; the leaf button carries `openTestId`. */
		testId?: string;
		disabled?: boolean;
		/** More actions between the name and the ×, as small icon buttons. */
		children?: Snippet;
	}>;
	let {
		id,
		name,
		path = [],
		onopen,
		openTestId,
		onremove,
		removeLabel,
		removeTestId,
		testId,
		disabled = false,
		children
	}: Props = $props();
	const full = $derived([...path.map((scope) => scope.name), name].join(' › '));
</script>

{#snippet segment(scope: Named, leaf: boolean)}
	{#if onopen}
		<button
			type="button"
			class={[
				'min-w-0 cursor-pointer truncate py-0.5 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent',
				leaf ? 'text-ink' : 'text-muted'
			]}
			data-testid={leaf ? openTestId : undefined}
			{disabled}
			onclick={() => onopen(scope.id)}>{scope.name}</button
		>
	{:else}<span class={['min-w-0 truncate py-0.5', !leaf && 'text-muted']}>{scope.name}</span>{/if}
{/snippet}

<!-- A Scope as one compact chip: the path reads muted, every name is a way there, the
     actions are small icons at the end. -->
<span
	class="scope-chip inline-flex max-w-full min-w-0 items-center rounded-[var(--cg-radius-control)] border border-outline bg-raised pl-1.5 text-xs text-ink"
	title={full}
	data-testid={testId}
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
