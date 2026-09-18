<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	let {
		page,
		pages,
		label,
		onpage
	}: { page: number; pages: number; label: string; onpage: (page: number) => void } = $props();
</script>

{#if pages > 1}
	<nav class="flex flex-wrap items-center gap-2 text-sm" aria-label={label}>
		<Button size="sm" disabled={page === 0} onclick={() => onpage(page - 1)}
			>{t('kindHistory.previous')}</Button
		>
		<span aria-live="polite">{t('kindHistory.page', { page: page + 1, pages })}</span>
		<Button size="sm" disabled={page >= pages - 1} onclick={() => onpage(page + 1)}
			>{t('kindHistory.next')}</Button
		>
	</nav>
{/if}
