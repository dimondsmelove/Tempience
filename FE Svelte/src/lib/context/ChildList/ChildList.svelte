<script lang="ts" generics="T extends ChildItem">
	import { CHIP_CLASS } from '$lib/context/constants';
	import { getLens, lensSource } from '$lib/ui/LensSource';
	import type { ChildItem, ChildListProps } from './types';

	let { items, testId, onpick, lead }: ChildListProps<T> = $props();
	const hover = getLens();
</script>

<!-- Entities under or beside the one in the Context, one chip each; a click goes there. -->
<div class="flex flex-wrap gap-1">
	{#each items as item (item.key)}
		<button
			type="button"
			class={[CHIP_CLASS, 'cursor-pointer hover:text-ink', item.current && 'current']}
			data-testid={testId}
			data-note={item.noted || undefined}
			aria-current={item.current || undefined}
			onclick={() => onpick(item)}
			{@attach lensSource(hover, item.lens)}>{@render lead?.(item)}{item.label}</button
		>
	{/each}
</div>

<style>
	/* The one in force: the accent outline every chosen control carries. */
	.current {
		border-color: var(--cg-accent);
		color: var(--cg-text-primary);
	}
</style>
