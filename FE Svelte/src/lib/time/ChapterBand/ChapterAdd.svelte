<script lang="ts">
	import { PlusOutline } from 'flowbite-svelte-icons';
	import { t } from '$lib/state/Locale/Locale.svelte';

	let { onclick }: { onclick: () => void } = $props();
</script>

<!-- «Начать главу»: the band's own «+», and the whole band while the space has no chapter yet. -->
<button
	type="button"
	class="add"
	aria-label={t('chapter.start')}
	title={t('chapter.start')}
	data-testid="chapter-add"
	{onclick}><PlusOutline class="h-3.5 w-3.5" /></button
>

<style>
	.add {
		display: grid;
		flex: none;
		place-items: center;
		width: 20px;
		height: 18px;
		border: 0;
		border-radius: var(--cg-radius-control);
		background: var(--cg-bg-surface);
		color: var(--cg-text-muted);
		cursor: pointer;
	}
	.add:hover {
		color: var(--cg-text-primary);
		background: var(--cg-bg-raised);
	}
	.add:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: -2px;
	}
</style>
