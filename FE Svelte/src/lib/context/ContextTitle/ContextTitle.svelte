<script lang="ts">
	import type { ContextTitleProps } from './types';

	let { title, meta, dot, leading = 'snug', onclick, actionLabel }: ContextTitleProps = $props();
	const heading = $derived(
		leading === 'tight'
			? 'text-lg leading-tight font-semibold'
			: 'min-w-0 text-lg leading-snug font-semibold break-words'
	);
</script>

{#snippet name()}
	<h2 class={heading} data-testid="selected-title">
		{#if onclick}<button
				type="button"
				class="cursor-pointer text-left hover:text-accent focus-visible:outline-2 focus-visible:outline-accent"
				title={actionLabel}
				{onclick}>{title}</button
			>{:else}{title}{/if}
	</h2>
{/snippet}

<!-- The head of every Context: a mono line of what the entity is, then its name, a colour dot
     before it where the entity has a colour. -->
{#if meta !== undefined}<span class="font-mono text-xs text-muted" data-testid="context-meta"
		>{meta}</span
	>{/if}
{#if dot}
	<div class="flex items-center gap-2">
		{@render dot()}
		{@render name()}
	</div>
{:else}
	{@render name()}
{/if}
