<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { demoStoriesFor } from '$lib/scenarios/demo/registry';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import {
		CHOICE_CARD_CLASS,
		DEMO_STORIES_TEST_ID,
		demoStoryOpenTestId,
		demoStoryTestId
	} from './constants';
	import type { DemoStoriesProps } from './types';

	let {
		entries = demoStoriesFor(locale.current),
		onopen,
		variant,
		busy = false,
		activeId,
		after
	}: DemoStoriesProps = $props();
	const id = $props.id();
	/** The story already open is not offered again; the host shows its notice instead. */
	const offered = $derived(entries.filter((entry) => entry.id !== activeId));
</script>

<!-- The cards fill the row, however many there are (owner 2026-09-29): one story takes the whole
     width, two sit side by side, a phone stacks them; the host's own choice joins the same grid. -->
{#if variant === 'cards'}
	{#if offered.length || after}
		<div
			class="grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-3"
			data-testid={DEMO_STORIES_TEST_ID}
		>
			{#each offered as entry (entry.id)}
				<!-- The whole card opens the story, as «Начать со своих записей» next to it. -->
				<div class="flex" data-testid={demoStoryTestId(entry.id)}>
					<button
						type="button"
						class={[CHOICE_CARD_CLASS, 'w-full']}
						aria-labelledby={`${id}-${entry.id}`}
						aria-describedby={`${id}-${entry.id}-body`}
						data-testid={demoStoryOpenTestId(entry.id)}
						disabled={busy}
						onclick={() => onopen(entry)}
					>
						<span id={`${id}-${entry.id}`} class="font-semibold">{t(entry.titleKey)}</span>
						<span id={`${id}-${entry.id}-body`} class="text-sm leading-relaxed text-muted"
							>{t(entry.bodyKey)}</span
						>
					</button>
				</div>
			{/each}
			{@render after?.()}
		</div>
	{/if}
{:else if offered.length}
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
