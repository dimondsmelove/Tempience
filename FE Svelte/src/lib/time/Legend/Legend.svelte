<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import {
		LEGEND_KEY_LABELS,
		LEGEND_STATES,
		LEGEND_STATE_LABELS
	} from '$lib/model/Legend/constants';
	import { listedLegendKeys } from '$lib/model/Legend/Legend';
	import type { LegendProps } from './types';

	let { filters, present, id, hidden = false }: LegendProps = $props();
	/** The kinds on offer in the view, plus a hidden or soloed one so it can be undone (research п. 17). */
	const listed = $derived(listedLegendKeys(present, filters));
</script>

<!-- The legend on the ribbon is the filter too: click = only this kind, the same click = all,
     Shift+click = hide one kind (struck through while no solo is on). The swatches repeat the
     mark language in an ink tone, never a Scope colour; state items explain, they never filter. -->
<div {id} {hidden} class="legend" role="group" aria-label={t('legend.title')} data-testid="legend">
	{#each listed as key (key)}
		<button
			type="button"
			class={['item', !filters.soloLegend && filters.hiddenLegend.has(key) && 'off']}
			aria-pressed={filters.soloLegend === key}
			data-legend={key}
			onclick={(event) =>
				event.shiftKey ? filters.toggleLegend(key) : filters.soloLegendKind(key)}
		>
			<span class="swatch k-{key}" aria-hidden="true"></span>{t(LEGEND_KEY_LABELS[key])}
		</button>
	{/each}
	{#each LEGEND_STATES as key (key)}
		<span class="item" data-legend-state={key}>
			<span class="swatch s-{key}" aria-hidden="true"></span>{t(LEGEND_STATE_LABELS[key])}
		</span>
	{/each}
	<span class="hint">{t('legend.hint')}</span>
</div>

<style>
	.legend {
		--legend-ink: var(--cg-text-secondary);
		--legend-ink-30: color-mix(in srgb, var(--legend-ink) 30%, transparent);
		--legend-ink-45: color-mix(in srgb, var(--legend-ink) 45%, transparent);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: calc(var(--cg-gap) * 0.75) calc(var(--cg-gap) * 2.25);
		padding: calc(var(--cg-gap) * 0.75) calc(var(--cg-panel-padding) * 0.857143);
		border-bottom: var(--cg-border-width) solid var(--cg-border-default);
		background: var(--cg-bg-surface);
		color: var(--cg-text-muted);
		font-size: var(--cg-text-size-caption);
		line-height: 1.3;
	}
	.legend[hidden] {
		display: none;
	}
	.item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	button.item {
		font: inherit;
		color: inherit;
		background: none;
		border: 0;
		cursor: pointer;
		border-radius: var(--cg-radius-control);
		padding: 1px 4px;
		margin: -1px -4px;
		text-align: left;
	}
	button.item:hover {
		color: var(--cg-text-primary);
	}
	button.item:focus-visible {
		outline: 2px solid var(--cg-focus);
		outline-offset: 1px;
	}
	button.item[aria-pressed='true'] {
		color: var(--cg-text-primary);
		background: color-mix(in srgb, var(--cg-accent) 12%, transparent);
	}
	button.item.off {
		text-decoration: line-through;
		opacity: 0.55;
	}
	.hint {
		margin-left: auto;
		font-size: calc(var(--cg-text-size-caption) * 0.92);
	}
	/* Swatches: the mark language at 14 px, as the approved mock draws it. */
	.swatch {
		display: inline-block;
		flex: none;
		height: 14px;
		border-radius: 2px;
		background: var(--legend-ink);
	}
	.k-fact {
		width: 3px;
	}
	.k-interval {
		width: 22px;
		background: linear-gradient(90deg, var(--legend-ink) 0 3px, var(--legend-ink-30) 3px);
	}
	.k-open {
		width: 34px;
		background: linear-gradient(90deg, var(--legend-ink) 0 3px, var(--legend-ink-30) 3px);
	}
	.k-fuzzy {
		width: 22px;
		background: var(--legend-ink-30);
	}
	.k-intent,
	.k-overdue {
		width: 3px;
		background: repeating-linear-gradient(180deg, var(--legend-ink) 0 3px, transparent 3px 5px);
	}
	.k-closed {
		width: 3px;
		background: repeating-linear-gradient(
			180deg,
			var(--legend-ink) 0 3px,
			var(--legend-ink-45) 3px 5px
		);
	}
	.k-fuzzyIntent {
		width: 22px;
		background:
			repeating-linear-gradient(180deg, var(--legend-ink) 0 3px, transparent 3px 5px) 0 0 / 3px 100%
				no-repeat,
			linear-gradient(90deg, var(--legend-ink-30), var(--legend-ink-30)) 3px 0 / calc(100% - 3px)
				100% no-repeat;
	}
	.k-proposal {
		width: 7px;
		background: transparent;
		border: 1px solid var(--legend-ink);
	}
	.k-rollup {
		width: 3px;
		opacity: 0.3;
	}
	.k-multi {
		width: 4px;
		background: linear-gradient(180deg, var(--legend-ink) 0 50%, var(--cg-text-muted) 50%);
	}
	.s-selected {
		width: 3px;
		outline: 1px solid var(--cg-text-primary);
		outline-offset: 2px;
	}
	.s-projections {
		width: 1px;
		background: repeating-linear-gradient(180deg, var(--cg-accent) 0 2px, transparent 2px 6px);
	}
	.s-link {
		width: 18px;
		height: 8px;
		background: transparent;
		border: 1px solid var(--cg-text-primary);
		border-top: 0;
		border-radius: 0;
	}
</style>
