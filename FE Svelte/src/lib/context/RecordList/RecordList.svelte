<script lang="ts">
	import { groupRecords } from '$lib/model/RecordGroups/RecordGroups';
	import { locale } from '$lib/state/Locale/Locale.svelte';
	import RecordGroupHead from './RecordGroupHead.svelte';
	import RecordRow from './RecordRow.svelte';
	import type { RecordListProps } from './types';

	let { items, testId, empty, group = null, onselect }: RecordListProps = $props();
	const groups = $derived(items.length ? groupRecords(items, group, locale.current) : []);
</script>

<!-- A Context's records, cut into weeks, days or months under a mono header with the count, the
     way the axis reads time; a short list or one inside a single stretch stands whole. The rows
     sit close in their own column, whatever gap the section around them keeps. -->
{#if groups.length}
	<div class="list">
		{#each groups as part (`${part.key}:${part.items[0]?.traceId}`)}
			{#if part.label}<RecordGroupHead label={part.label} count={part.items.length} />{/if}
			{#each part.items as item (item.traceId)}
				<RecordRow {item} {testId} {onselect} />
			{/each}
		{/each}
	</div>
{:else}<p class="text-sm text-muted">{empty}</p>{/if}

<style>
	.list {
		display: flex;
		flex-direction: column;
	}
</style>
