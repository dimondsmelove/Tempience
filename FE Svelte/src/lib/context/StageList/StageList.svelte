<script lang="ts">
	import { PenOutline, TrashBinOutline } from 'flowbite-svelte-icons';
	import { LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { idsAt } from '$lib/model/Chapters';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { ScopeDot } from '$lib/ui/ScopeDot';
	import type { StageListProps } from './types';

	let {
		windows,
		inForceId,
		nowId,
		colour,
		spanOf,
		scopeOf,
		onchoose,
		onedit,
		onremove
	}: StageListProps = $props();
	/** The stage whose removal waits for a yes. */
	let removing = $state<string | null>(null);
</script>

<!-- The stages under the strip, as the lab listed them: name, the dots of a lineup of its own,
     the dates, the note; each edited and removed from its own row. The one in force is tinted. -->
<ul class="grid gap-0.5" style:--chapter={colour}>
	{#each windows as item (item.stage.id)}
		<li class={['stage', item.stage.id === inForceId && 'picked']} data-testid="stage-row">
			<div class="flex items-center gap-1">
				<button
					type="button"
					class={[LIST_BUTTON_CLASS, 'min-w-0 flex-1']}
					aria-current={item.stage.id === inForceId || undefined}
					data-testid="chapter-stage-item"
					onclick={() => onchoose(item.stage.id)}
				>
					<span class="flex w-full min-w-0 items-center gap-2">
						<span
							class={['min-w-0 text-sm break-words', item.stage.id === nowId && 'font-semibold']}
							>{item.stage.name}</span
						>
						{#if item.stage.lineup}
							<span class="flex shrink-0 items-center gap-0.5" data-testid="stage-own-lineup">
								{#each idsAt(item.stage.lineup) as id (id)}
									{@const scope = scopeOf(id)}
									<ScopeDot
										colorHue={scope?.colorHue ?? null}
										colorChroma={scope?.colorChroma ?? null}
										colorDepth={scope?.colorDepth ?? null}
									/>
								{/each}
							</span>
						{/if}
					</span>
					<span class="font-mono text-xs whitespace-nowrap text-muted">{spanOf(item)}</span>
					{#if item.stage.note}<span class="text-xs text-muted">{item.stage.note}</span>{/if}
				</button>
				<Button
					size="sm"
					variant="quiet"
					icon
					aria-label={t('chapter.stageEditNamed', { name: item.stage.name })}
					title={t('chapter.stageEditNamed', { name: item.stage.name })}
					data-testid="stage-edit"
					onclick={() => onedit(item.stage.id)}><PenOutline class="h-4 w-4" /></Button
				>
				<Button
					size="sm"
					variant="quiet"
					icon
					aria-label={t('chapter.stageDeleteNamed', { name: item.stage.name })}
					title={t('chapter.stageDeleteNamed', { name: item.stage.name })}
					data-testid="stage-row-delete"
					onclick={() => (removing = item.stage.id)}><TrashBinOutline class="h-4 w-4" /></Button
				>
			</div>
			{#if removing === item.stage.id}
				<div
					class="mt-1 flex flex-wrap items-center gap-2 rounded-sm border border-outline bg-raised p-2 text-sm"
					role="alert"
					data-testid="stage-row-delete-confirm"
				>
					<span class="grow">{t('chapter.stageDeleteConfirm')}</span>
					<Button
						size="sm"
						variant="primary"
						data-testid="stage-row-delete-yes"
						onclick={async () => {
							await onremove(item.stage.id);
							removing = null;
						}}>{t('chapter.stageDeleteYes')}</Button
					>
					<Button size="sm" onclick={() => (removing = null)}>{t('common.cancel')}</Button>
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.stage.picked {
		border-radius: var(--cg-radius-control);
		background: color-mix(in oklab, var(--chapter) 12%, transparent);
	}
</style>
