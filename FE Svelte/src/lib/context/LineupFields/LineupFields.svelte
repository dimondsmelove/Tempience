<script lang="ts">
	import { CloseOutline } from 'flowbite-svelte-icons';
	import { idsAt, lineupFromIds } from '$lib/model/Chapters';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { chapterColour } from '$lib/theme/chapter-colour';
	import { ScopePicker, scopeAncestors, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import type { LineupFieldsProps } from './types';

	let { lineup, view, onchange, offered = null, testId }: LineupFieldsProps = $props();
	const options = $derived(scopeOptionsOf(view.scopes, view.intersections));
	const ids = $derived(idsAt(lineup));
	const nameOf = (id: string): string =>
		view.scopes.find((scope) => scope.id === id)?.name ?? t('draft.scopeUnavailable');
	const scopeOf = (id: string) => view.scopes.find((scope) => scope.id === id);
	const put = (next: readonly string[]): void => onchange(lineupFromIds(next));
	const groups = $derived(
		offered?.ids.length
			? { groups: [{ label: offered.label, ids: offered.ids }], rest: t('chapter.captureRest') }
			: null
	);
</script>

<!-- «Состав» (owner 2026-09-28): the Scopes a chapter puts in front, a set; taken out by ×,
     added below. -->
<div class="grid min-w-0 gap-1" data-testid={testId}>
	<span class="text-sm">{t('chapter.lineup')}</span>
	<ul class="list" aria-label={t('chapter.lineup')}>
		{#each ids as id (id)}
			{@const name = nameOf(id)}
			{@const scope = scopeOf(id)}
			{@const path = scopeAncestors(options, id)}
			<li class="entry" data-testid="{testId}-entry" data-scope-name={name}>
				<!-- The colour (ink without one), the path a small muted line above the name, the name
				     whole; × takes it out. A lineup is a set: the rail keeps the device's order. -->
				<span class="dot" style:--dot={scope ? chapterColour(scope) : undefined}></span>
				<span class="scope" title={[...path.map((item) => item.name), name].join(' › ')}>
					{#if path.length}<span class="ancestors"
							>{path.map((item) => item.name).join(' › ')} ›</span
						>{/if}
					<span class="leaf">{name}</span>
				</span>
				<Button
					size="sm"
					variant="quiet"
					icon
					aria-label={t('draft.scopeRemove', { name })}
					title={t('draft.scopeRemove', { name })}
					onclick={() => put(ids.filter((item) => item !== id))}
					><CloseOutline class="h-3.5 w-3.5" /></Button
				>
			</li>
		{:else}<li class="empty">{t('chapter.lineupEmpty')}</li>{/each}
	</ul>
	<ScopePicker
		scopes={options}
		exclude={ids}
		{groups}
		label={t('chapter.lineupAdd')}
		placeholder={t('chapter.lineupPlaceholder')}
		size="sm"
		testId="{testId}-add"
		onpick={(id) => {
			if (id) put([...ids, id]);
		}}
	/>
</div>

<style>
	/* The rows may be narrower than a long path: it gives way, the form never outgrows the Context. */
	.list {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: 2px;
		min-height: 32px;
		padding: 2px;
		border-radius: var(--cg-radius-control);
	}
	.entry {
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 1px 2px;
		border-radius: var(--cg-radius-control);
	}
	.dot {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 9999px;
		background: var(--dot, var(--cg-text-muted));
	}
	.scope {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		font-size: 14px;
	}
	.ancestors {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12px;
		line-height: 1.2;
		color: var(--cg-text-muted);
	}
	.leaf {
		overflow-wrap: anywhere;
	}
	.empty {
		padding: 4px 6px;
		color: var(--cg-text-muted);
		font-size: 12px;
	}
</style>
