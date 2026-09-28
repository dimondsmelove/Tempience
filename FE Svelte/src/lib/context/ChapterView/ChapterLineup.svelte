<script lang="ts">
	import { LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { lineupRows } from '$lib/model/Chapters';
	import type { Lineup } from '$lib/model/Chapters/types';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import { getLens, lensSource } from '$lib/ui/LensSource';
	import { ScopeDot } from '$lib/ui/ScopeDot';
	import { scopeAncestors, scopeOptionsOf } from '$lib/ui/ScopePicker';

	type Props = Readonly<{
		workbench: WorkbenchState;
		lineup: Lineup;
		/** How many of the Context's records each Scope holds, nested Scopes included. */
		counts?: ReadonlyMap<string, number>;
	}>;
	let { workbench, lineup, counts }: Props = $props();
	const scopesById = $derived(new Map(workbench.view.scopes.map((scope) => [scope.id, scope])));
	/** The tree, so a nested Scope reads «Корень › … › Лист» as in the editor and the record Context. */
	const options = $derived(scopeOptionsOf(workbench.view.scopes, workbench.view.intersections));
	const hover = getLens();
</script>

<!-- «Состав» in the order the rail shows it, a Scope under its lineup ancestor one step in (owner 2026-09-28): the Scope's colour, its path and name, how many records it holds here; a click opens
     the Scope, the pointer lights it on the ribbon. -->
{#if lineup.length}
	<ol class="grid" data-testid="chapter-lineup-list">
		{#each lineupRows(lineup, workbench.view, workbench.chapters.arrangement) as row (row.scopeId)}
			{@const id = row.scopeId}
			{@const scope = scopesById.get(id)}
			{@const path = scopeAncestors(options, id)}
			<li>
				<button
					type="button"
					class={[LIST_BUTTON_CLASS, 'entry']}
					style:padding-left="calc(0.5rem + {row.depth * 1.25}rem)"
					data-testid="chapter-lineup-entry"
					onclick={() => workbench.selectScope(id, 'context')}
					{@attach lensSource(hover, { kind: 'scope', scopeId: id })}
				>
					<!-- A Scope without a colour of its own is ink, as the ribbon draws its marks. -->
					<span class="dot-slot"
						>{#if scope?.colorHue === null || scope?.colorHue === undefined}<span class="ink-dot"
							></span>{:else}<ScopeDot
								colorHue={scope.colorHue}
								colorChroma={scope.colorChroma ?? null}
								colorDepth={scope.colorDepth ?? null}
							/>{/if}</span
					>
					<!-- A nested Scope: its path a small muted line above the name, cut with an ellipsis,
					     the full path in the hint; the name itself whole below. -->
					<span
						class="path"
						title={[...path.map((item) => item.name), scope?.name].filter(Boolean).join(' › ')}
					>
						{#if path.length}<span class="ancestors"
								>{path.map((item) => item.name).join(' › ')} ›</span
							>{/if}
						<span class="leaf">{scope?.name ?? t('draft.scopeUnavailable')}</span>
					</span>
					{#if (counts?.get(id) ?? 0) > 0}<span class="font-mono text-xs text-muted"
							>{counts?.get(id)}</span
						>{/if}
				</button>
			</li>
		{/each}
	</ol>
{:else}<p class="text-sm text-muted">{t('chapter.lineupEmpty')}</p>{/if}

<style>
	.entry {
		display: grid;
		grid-template-columns: 8px minmax(0, 1fr) auto;
		align-items: center;
		column-gap: 8px;
	}
	.dot-slot {
		display: flex;
		width: 8px;
	}
	.ink-dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
		background: var(--cg-text-muted);
	}
	.path {
		display: flex;
		min-width: 0;
		flex-direction: column;
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
</style>
