<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { demoStoriesFor } from '$lib/scenarios/demo/registry';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { DEMO_STORIES_TEST_ID, demoStoryOpenTestId, demoStoryTestId } from './constants';
	import type { DemoStoriesProps } from './types';

	let {
		entries = demoStoriesFor(locale.current),
		onopen,
		variant,
		busy = false,
		activeId
	}: DemoStoriesProps = $props();
	const id = $props.id();
	/** The story already open is not offered again; the host shows its notice instead. */
	const offered = $derived(entries.filter((entry) => entry.id !== activeId));
</script>

{#if offered.length}
	{#if variant === 'cards'}
		<div class="grid gap-3 sm:grid-cols-2" data-testid={DEMO_STORIES_TEST_ID}>
			{#each offered as entry (entry.id)}
				<article
					class="cg-panel flex flex-col items-start gap-2 border border-outline bg-raised text-left"
					aria-labelledby={`${id}-${entry.id}`}
					data-testid={demoStoryTestId(entry.id)}
				>
					<span id={`${id}-${entry.id}`} class="font-semibold">{t(entry.titleKey)}</span>
					<span class="text-sm leading-relaxed text-muted">{t(entry.bodyKey)}</span>
					<Button
						variant="primary"
						data-testid={demoStoryOpenTestId(entry.id)}
						disabled={busy}
						onclick={() => onopen(entry)}>{t(entry.openKey)}</Button
					>
				</article>
			{/each}
		</div>
	{:else}
		<div class="flex flex-col items-start gap-2" data-testid={DEMO_STORIES_TEST_ID}>
			{#each offered as entry (entry.id)}
				<Button
					size="sm"
					data-testid={demoStoryOpenTestId(entry.id)}
					disabled={busy}
					onclick={() => onopen(entry)}>{t(entry.openKey)}</Button
				>
			{/each}
		</div>
	{/if}
{/if}
