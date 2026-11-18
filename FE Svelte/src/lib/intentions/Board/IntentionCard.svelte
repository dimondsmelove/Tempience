<script lang="ts">
	import { Temporal } from 'temporal-polyfill';
	import OutcomeCircle from '../OutcomeCircle/OutcomeCircle.svelte';
	import { intentionResults } from '../Results/Results';
	import type { ResultOutcome } from '../Outcome/types';
	import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
	import type { ExplorerIntersection } from '$lib/model/Snapshot/types';
	import { getContext } from 'svelte';
	import { boardWhenContext, type BoardWhenContext } from '../WhenModel/boardWhen';
	import WhenPopover from '../WhenPopover/WhenPopover.svelte';
	import type { ExplorerTrace, ExplorerScope } from '$lib/model/Snapshot/types';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { crumbOf, type Hierarchy } from '../Hierarchy/Hierarchy';
	let {
		trace,
		scopes,
		traces,
		hierarchy,
		zone,
		showDate = false,
		compact = false,
		listIds = [],
		complete,
		preset,
		repeat = () => {},
		links,
		assessments,
		move,
		edit,
		dragging,
		startDrag,
		endDrag,
		keyboardMove
	}: {
		trace: ExplorerTrace;
		scopes: readonly ExplorerScope[];
		traces: readonly ExplorerTrace[];
		hierarchy: Hierarchy;
		zone: string;
		showDate?: boolean;
		compact?: boolean;
		listIds?: readonly string[];
		complete: (id: string) => void;
		preset: (id: string, value: 'completed' | 'none' | 'not_completed' | ResultOutcome) => void;
		repeat?: (id: string, day: string, now: number) => void;
		links: readonly ExplorerIntersection[];
		assessments: readonly IntentionAssessment[];
		move: (id: string, date: string | null) => void;
		edit: (id: string) => void;
		dragging: boolean;
		startDrag: (trace: ExplorerTrace, event: DragEvent) => void;
		endDrag: () => void;
		keyboardMove: (direction: -1 | 1) => void;
	} = $props();
	const when = getContext<BoardWhenContext>(boardWhenContext);
	const closed = $derived(trace.intentOpen === false);
	const results = $derived(intentionResults(trace.id, traces, links, assessments));
	const crumb = $derived(
		(hierarchy.get(trace.id)?.parents ?? []).some((id) => listIds.includes(id))
			? null
			: crumbOf(trace.id, hierarchy, traces)
	);
	let didDrag = false;
	const progress = $derived(hierarchy.get(trace.id)?.progress);
	const date = $derived(
		trace.aboutTime?.basis === 'absolute'
			? trace.aboutTime.precision === 'minute'
				? Temporal.Instant.from(trace.aboutTime.start)
						.toZonedDateTimeISO(zone)
						.toPlainDate()
						.toString()
				: trace.aboutTime.start.slice(0, 10)
			: ''
	);
	const time = $derived(
		trace.aboutTime?.basis === 'absolute' && trace.aboutTime.precision === 'minute'
			? new Intl.DateTimeFormat(locale.current, {
					hour: '2-digit',
					minute: '2-digit',
					timeZone: zone
				}).format(new Date(trace.aboutTime.start))
			: ''
	);
	const dateLabel = $derived(
		date
			? new Intl.DateTimeFormat(locale.current, {
					weekday: 'short',
					day: 'numeric',
					month: 'short',
					timeZone: 'UTC'
				}).format(new Date(`${date}T12:00:00Z`))
			: ''
	);
</script>

<article
	class:closed
	class:completed={trace.intentOutcome === 'completed'}
	class:dragging
	class:compact
	role="presentation"
	onclick={(event) => {
		if (
			!didDrag &&
			event.target instanceof Element &&
			!event.target.closest('button, a, input, [popover]')
		)
			edit(trace.id);
	}}
	draggable={!closed}
	ondragstart={(event) => {
		didDrag = true;
		startDrag(trace, event);
	}}
	ondragend={() => {
		endDrag();
		setTimeout(() => {
			didDrag = false;
		}, 0);
	}}
	data-testid="intention-card"
>
	{#if crumb}<div class="crumb">
			{crumb.title.split('\n')[0]}{crumb.extra ? ` +${crumb.extra}` : ''} ›
		</div>{/if}
	<div class="outcome">
		<OutcomeCircle
			outcome={trace.intentOutcome}
			open={!closed}
			{zone}
			activate={() => complete(trace.id)}
			preset={(value) => preset(trace.id, value)}
			repeat={(day, now) => repeat(trace.id, day, now)}
		/>
	</div>
	<button
		class="title"
		onkeydown={(event) => {
			if (!closed && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
				event.preventDefault();
				keyboardMove(event.key === 'ArrowUp' ? -1 : 1);
			}
		}}
		onclick={() => edit(trace.id)}>{trace.content.split('\n')[0]}</button
	>
	<div class="card-actions">
		<WhenPopover
			{trace}
			{zone}
			now={when.context().now}
			weekStart={when.context().weekStart}
			disabled={closed}
			onpick={(choice) => when.pick(trace.id, choice)}
		/>
		<span class:hidden={!date}
			><Button
				variant="quiet"
				size="sm"
				icon
				disabled={closed || !date}
				aria-label={t('intentions.removeDate')}
				onclick={() => {
					if (when) when.pick(trace.id, { kind: 'undated' });
					else move(trace.id, null);
				}}>×</Button
			></span
		>
	</div>
	{#if trace.intentOutcome === 'alternative' && results.alternative}
		<div class="result-summary">→ {results.alternative}</div>
	{:else if trace.intentOutcome === 'partial'}
		<div class="result-summary">{t('intentions.partialSummary', { count: results.count })}</div>
	{:else if !closed && !trace.intentOutcome && results.count}
		<div class="result-summary">{t('intentions.resultsSummary', { count: results.count })}</div>
	{:else if closed && !trace.intentOutcome}
		<div class="result-summary">{t('intentions.closedSummary')}</div>
	{/if}
	<div class="metadata">
		{#each scopes as scope (scope.id)}<ScopeChip
				id={scope.id}
				name={scope.name}
				colorHue={scope.colorHue}
				colorChroma={scope.colorChroma}
				colorDepth={scope.colorDepth}
			/>{/each}
		{#if time}<span class="mono">{time}</span>{/if}
		{#if showDate && date}<span class="mono">{dateLabel}</span>{/if}
		{#if progress}<span class="progress"
				>{#if progress.total <= 6}<span class="segments" aria-hidden="true"
						>{#each Array.from({ length: progress.total }, (_, i) => i) as i (i)}<span
								class:done={i < progress.done}
							></span>{/each}</span
					>{/if}<span class="mono">{progress.done}/{progress.total}</span></span
			>{/if}
	</div>
</article>

<style>
	article {
		display: grid;
		grid-template-columns: 16px 14px minmax(0, 1fr) auto;
		grid-template-rows: auto auto auto auto;
		column-gap: 4px;
		row-gap: 2px;
		align-items: start;
		cursor: pointer;
		padding: 6px;
		border-radius: 6px;
		min-width: 0;
	}
	article:hover,
	article:focus-within {
		background: var(--cg-bg-raised);
	}

	article.dragging {
		opacity: 0.45;
		cursor: grabbing;
	}
	.outcome {
		grid-column: 1 / 3;
		grid-row: 2;
	}
	.result-summary {
		grid-column: 3 / 5;
		grid-row: 3;
		color: var(--cg-text-muted);
		font-size: 12px;
		overflow-wrap: anywhere;
	}
	.card-actions {
		grid-column: 3 / 5;
		grid-row: 2;
		display: flex;
		align-items: center;
		justify-self: end;
		height: 20px;
		visibility: hidden;
		background: var(--cg-bg-raised);
		z-index: 1;
	}
	article:hover .card-actions,
	article:focus-within .card-actions,
	article:has(:global(:popover-open)) .card-actions {
		visibility: visible;
	}
	.card-actions > :global(button),
	.card-actions > span :global(button) {
		min-height: 0;
		height: 18.2px;
		width: 22px;
		padding: 0;
	}
	.hidden {
		visibility: hidden;
	}
	.crumb {
		grid-column: 3 / 5;
		grid-row: 1;
	}
	.metadata {
		grid-column: 3 / 5;
		grid-row: 4;
	}
	.title {
		grid-column: 3 / 5;
		grid-row: 2;
	}
	@media (hover: none) {
		.card-actions {
			grid-column: 4;
			visibility: visible;
			background: transparent;
		}
		.title {
			grid-column: 3;
		}
	}
	.compact .crumb,
	.compact .metadata {
		display: none;
	}
	.title {
		color: var(--cg-text-primary);
		flex: 1;
		min-width: 0;
		cursor: pointer;
	}
	.title:hover {
		color: var(--cg-text-primary);
	}
	.title:focus-visible {
		outline: 2px solid var(--cg-accent);
		outline-offset: 2px;
	}
	.title {
		overflow-wrap: anywhere;
		padding-left: 4px;
		text-align: left;
		font-size: 14px;
		line-height: 20px;
	}
	.closed .title {
		color: var(--cg-text-muted);
	}
	.closed.completed .title {
		text-decoration: line-through;
	}
	.crumb {
		color: var(--cg-text-muted);
		font-size: 12px;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.metadata {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 3px 8px;
		color: var(--cg-text-muted);
		font-size: 12px;
	}
	.progress {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		min-width: 0;
	}
	.mono {
		font-family: var(--cg-font-mono);
	}
	.segments {
		display: inline-flex;
		gap: 2px;
	}
	.segments span {
		width: 8px;
		height: 3px;
		border-radius: 1px;
		background: var(--cg-border-default);
	}
	.segments .done {
		background: var(--cg-text-muted);
	}
</style>
