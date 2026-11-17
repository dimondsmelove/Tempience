<script lang="ts">
	import type { ComponentProps } from 'svelte';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import type { IntentionsState } from '$lib/state/Intentions/Intentions.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import IntentionShelf from './IntentionShelf.svelte';
	import { canDrop } from './drag';
	type Shelf = ComponentProps<typeof IntentionShelf>;
	let {
		buckets,
		treeItems,
		zone,
		scopes,
		links,
		traces,
		hierarchy,
		add,
		drag,
		startDrag,
		endDrag,
		drop,
		keyboardMove,
		complete,
		preset,
		assessments,
		move,
		edit,
		today,
		search
	}: Pick<
		Shelf,
		| 'zone'
		| 'scopes'
		| 'links'
		| 'traces'
		| 'hierarchy'
		| 'add'
		| 'drag'
		| 'startDrag'
		| 'endDrag'
		| 'drop'
		| 'keyboardMove'
		| 'complete'
		| 'preset'
		| 'assessments'
		| 'move'
		| 'edit'
	> & {
		buckets: IntentionsState['buckets'];
		treeItems: (items: readonly ExplorerTrace[], includeClosed?: boolean) => ExplorerTrace[];
		today: string;
		search: string;
	} = $props();
	let sidebarHover = $state(false);
	const hasMatches = $derived(
		[buckets.review, buckets.later, buckets.undated].some((items) => treeItems(items).length > 0)
	);
</script>

{#if !buckets.review.length && !buckets.later.length && !buckets.undated.length}<p>
		{t('intentions.backlogEmpty')}
	</p>{:else if search.trim() && !hasMatches}<p>{t('intentions.searchEmpty')}</p>{/if}
<div
	class:drop-target={sidebarHover && canDrop(drag, { kind: 'undated' })}
	role="presentation"
	ondragover={(event) => {
		if (
			!canDrop(drag, { kind: 'undated' }) ||
			!event.dataTransfer?.types.includes('application/x-tempience-intention')
		)
			return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		sidebarHover = true;
	}}
	ondragleave={(event) => {
		if (
			!(event.relatedTarget instanceof Node) ||
			!event.currentTarget.contains(event.relatedTarget)
		)
			sidebarHover = false;
	}}
	ondrop={(event) => {
		event.preventDefault();
		sidebarHover = false;
		if (
			drag &&
			canDrop(drag, { kind: 'undated' }) &&
			event.dataTransfer?.getData('application/x-tempience-intention') === drag.id
		)
			drop(drag.id, { kind: 'undated' }, null);
		endDrag();
	}}
>
	<div class="sidebar-content">
		{#if buckets.review.length}<IntentionShelf
				mode="sidebar"
				title={t('intentions.review')}
				hint={t('intentions.reviewHint')}
				items={treeItems(buckets.review, false)}
				{zone}
				{scopes}
				{links}
				{traces}
				{hierarchy}
				{add}
				{drag}
				{startDrag}
				{endDrag}
				{drop}
				{keyboardMove}
				{complete}
				{preset}
				{assessments}
				{move}
				{edit}
			/>{/if}
		{#if buckets.later.length}<IntentionShelf
				mode="sidebar"
				title={t('intentions.later')}
				hint={t('intentions.laterHint')}
				items={treeItems(buckets.later)}
				orderTarget={{ kind: 'later' }}
				tree
				{zone}
				{scopes}
				{links}
				{traces}
				{hierarchy}
				{add}
				{drag}
				{startDrag}
				{endDrag}
				{drop}
				{keyboardMove}
				{complete}
				{preset}
				{assessments}
				{move}
				{edit}
			/>{/if}
		<IntentionShelf
			mode="sidebar"
			title={t('intentions.someday')}
			hint={t('intentions.undatedHint')}
			items={treeItems(buckets.undated)}
			tree
			target={{ kind: 'undated' }}
			weekStart={buckets.weekStart}
			todayKey={today}
			{zone}
			{scopes}
			{links}
			{traces}
			{hierarchy}
			{add}
			{drag}
			{startDrag}
			{endDrag}
			{drop}
			{keyboardMove}
			{complete}
			{preset}
			{assessments}
			{move}
			{edit}
		/>
	</div>
</div>

<style>
	.drop-target {
		outline: 1px solid var(--cg-text-primary);
		outline-offset: -2px;
	}
	.sidebar-content {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-top: 16px;
	}
</style>
