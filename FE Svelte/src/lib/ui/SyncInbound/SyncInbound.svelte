<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';

	/**
	 * Changes from other devices landed while input was under way (owner, 2026-09-20): the
	 * input is left alone and the ribbon is read again on this click, not before. Nothing
	 * is rendered while no read is owed.
	 */
	let { pending, onrefresh }: { pending: boolean; onrefresh: () => void } = $props();
</script>

{#if pending}
	<button
		type="button"
		class="sync-inbound whitespace-nowrap rounded px-1.5 py-1 text-xs"
		data-testid="sync-inbound-refresh"
		onclick={onrefresh}
	>
		{t('sync.inboundRefresh')}
	</button>
{/if}
