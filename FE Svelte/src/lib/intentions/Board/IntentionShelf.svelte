<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
	import type { ResultOutcome } from '../Outcome/types';
	import { SvelteSet } from 'svelte/reactivity';
	import type {
		ExplorerTrace,
		ExplorerScope,
		ExplorerIntersection
	} from '$lib/model/Snapshot/types';
	import { beforeForPosition, type OrderTarget } from '../Order/Order';
	import type { MoveTarget } from '$lib/intentions/MoveIntention/types';
	import type { Hierarchy } from '../Hierarchy/Hierarchy';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import IntentionCard from './IntentionCard.svelte';
	import AddButton from './AddButton.svelte';
	import Traces from '../Traces/Traces.svelte';
	import type { DayTrace } from '../Traces/types';
	import { canDrop, type DraggedIntention } from './drag';
	import { visibleTreeRows } from './presentation';
	let {
		title,
		items,
		dayTraces = [],
		target,
		orderTarget = target,
		mode = 'day',
		tree = false,
		hint = '',
		dayNumber = '',
		today = false,
		todayKey = '',
		weekStart = 0,
		scopes,
		links,
		traces,
		hierarchy,
		zone,
		add,
		complete,
		preset,
		repeat = () => {},
		assessments,
		move,
		edit,
		drag,
		startDrag,
		endDrag,
		drop,
		keyboardMove
	}: {
		title: string;
		items: readonly ExplorerTrace[];
		dayTraces?: readonly DayTrace[];
		target?: MoveTarget;
		orderTarget?: OrderTarget;
		mode?: 'day' | 'week' | 'sidebar';
		tree?: boolean;
		hint?: string;
		dayNumber?: string;
		today?: boolean;
		todayKey?: string;
		weekStart?: number;
		scopes: readonly ExplorerScope[];
		links: readonly ExplorerIntersection[];
		traces: readonly ExplorerTrace[];
		hierarchy: Hierarchy;
		zone: string;
		add: (
			title: string,
			target: MoveTarget,
			scopeIds?: readonly string[],
			parentId?: string
		) => Promise<string | null>;
		complete: (id: string) => void;
		preset: (id: string, value: 'completed' | 'none' | 'not_completed' | ResultOutcome) => void;
		repeat?: (id: string, day: string, now: number) => void;
		assessments: readonly IntentionAssessment[];
		move: (id: string, date: string | null) => void;
		edit: (id: string) => void;
		drag: DraggedIntention | null;
		startDrag: (
			trace: ExplorerTrace,
			source: OrderTarget | undefined,
			event: DragEvent,
			nested: boolean
		) => void;
		endDrag: () => void;
		drop: (id: string, target: OrderTarget, beforeId: string | null) => void;
		keyboardMove: (id: string, target: OrderTarget, direction: -1 | 1) => void;
	} = $props();
	let hovering = $state(false);
	let insertion = $state<{ id: string; after: boolean } | null>(null);
	const collapsed = new SvelteSet<string>();
	const rows = $derived(
		tree
			? visibleTreeRows(items, hierarchy, collapsed)
			: items.map((trace) => ({ trace, level: 0 }))
	);
	const ids = $derived(items.map((item) => item.id));
	const toggle = (id: string) => {
		if (collapsed.has(id)) collapsed.delete(id);
		else collapsed.add(id);
	};
	const scopeFor = (id: string) =>
		scopes.filter((scope) =>
			links.some(
				(link) => link.kind === 'belongs_to' && link.fromId === id && link.toId === scope.id
			)
		);
</script>

<section
	class:shelf-day={mode === 'day'}
	class:shelf-week={mode === 'week'}
	class:shelf-sidebar={mode === 'sidebar'}
	class:drop-target={hovering && canDrop(drag, orderTarget)}
	class="shelf"
	aria-label={title}
	data-testid="intention-shelf"
	data-day-key={target?.kind === 'day' ? target.dayKey : undefined}
	ondragover={(event) => {
		if (
			!canDrop(drag, orderTarget) ||
			!event.dataTransfer?.types.includes('application/x-tempience-intention')
		)
			return;
		event.preventDefault();
		event.stopPropagation();
		event.dataTransfer.dropEffect = 'move';
		if (!(event.target instanceof Element) || !event.target.closest('.row')) insertion = null;
		hovering = true;
	}}
	ondragleave={(event) => {
		if (
			!(event.relatedTarget instanceof Node) ||
			!event.currentTarget.contains(event.relatedTarget)
		) {
			hovering = false;
			insertion = null;
		}
	}}
	ondrop={(event) => {
		if (!orderTarget || !canDrop(drag, orderTarget)) return;
		event.preventDefault();
		event.stopPropagation();
		hovering = false;
		if (drag && event.dataTransfer?.getData('application/x-tempience-intention') === drag.id)
			drop(
				drag.id,
				orderTarget,
				insertion
					? beforeForPosition(
							rows.filter((row) => row.level === 0).map((row) => row.trace.id),
							insertion.id,
							insertion.after
						)
					: null
			);
		insertion = null;
		endDrag();
	}}
>
	<header class:today>
		<h2>
			{title}{#if dayNumber}
				<span class="number">{dayNumber}</span>{/if}
		</h2>
		{#if today}<span class="today-label">{t('intentions.todayLabel')}</span>{/if}{#if hint}<span
				class="hint">{hint}</span
			>{/if}
	</header>
	<div class="items">
		{#each rows as row (row.trace.id)}
			<div
				role="presentation"
				class="row"
				class:indented={row.level > 0}
				class:insert-before={insertion?.id === row.trace.id && !insertion.after}
				class:insert-after={insertion?.id === row.trace.id && insertion.after}
				ondragover={(event) => {
					if (
						row.level ||
						!canDrop(drag, orderTarget) ||
						!event.dataTransfer?.types.includes('application/x-tempience-intention')
					)
						return;
					event.preventDefault();
					const rect = event.currentTarget.getBoundingClientRect();
					insertion = { id: row.trace.id, after: event.clientY >= rect.top + rect.height / 2 };
				}}
			>
				{#if tree && (hierarchy.get(row.trace.id)?.children ?? []).some( (id) => ids.includes(id) )}<Button
						variant="quiet"
						size="sm"
						icon
						class="tree-toggle"
						aria-label={collapsed.has(row.trace.id)
							? t('intentions.expandChildren')
							: t('intentions.collapseChildren')}
						aria-expanded={!collapsed.has(row.trace.id)}
						onclick={() => toggle(row.trace.id)}>{collapsed.has(row.trace.id) ? '›' : '⌄'}</Button
					>{/if}
				<IntentionCard
					trace={row.trace}
					scopes={scopeFor(row.trace.id)}
					{traces}
					{hierarchy}
					{zone}
					listIds={tree ? ids : []}
					compact={mode === 'week'}
					showDate={mode === 'sidebar' && target?.kind !== 'undated'}
					{complete}
					{preset}
					{repeat}
					{assessments}
					{links}
					{move}
					{edit}
					dragging={drag?.id === row.trace.id}
					startDrag={(item, event) => startDrag(item, orderTarget, event, row.level > 0)}
					keyboardMove={(direction) => {
						if (orderTarget && !row.level) keyboardMove(row.trace.id, orderTarget, direction);
					}}
					{endDrag}
				/>
			</div>
		{/each}
	</div>
	{#if target}<div class="add">
			<AddButton {target} {weekStart} today={todayKey} {scopes} {links} {traces} {add} />
		</div>{/if}
	{#if mode === 'day'}<Traces traces={dayTraces} open={edit} />{/if}
</section>

<style>
	.shelf {
		min-width: 0;
		border-radius: 6px;
	}
	.shelf-day {
		padding: 0 6px 16px;
		border-left: 1px solid var(--cg-border-default);
	}
	.shelf-day:first-child {
		border-left: 0;
		padding-left: 0;
	}
	.drop-target {
		outline: 1px solid var(--cg-text-primary);
		outline-offset: -2px;
	}
	header {
		display: flex;
		align-items: baseline;
		gap: 6px;
		min-width: 0;
	}
	.shelf-day header {
		padding: 12px 6px 8px;
		margin-bottom: 4px;
		border-bottom: 2px solid transparent;
	}
	.shelf-day header.today {
		border-color: var(--cg-accent);
	}
	h2 {
		font-size: 12px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--cg-text-muted);
	}
	.number {
		margin-left: 0.4rem;
		font-size: 18px;
		font-weight: 600;
		color: var(--cg-text-primary);
		letter-spacing: 0;
	}
	.today-label {
		margin-left: auto;
		color: var(--cg-accent);
		font-size: 12px;
	}
	.hint {
		font-size: 12px;
		color: var(--cg-text-muted);
	}
	.shelf-week {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		height: 54px;
		box-sizing: border-box;
		gap: 4px 16px;
		padding: 6px 14px;
		background: var(--cg-bg-surface);
	}
	/* The add button stands right after the label, so neither a long row of cards nor a panel
	   over the right edge can hide it. */
	.shelf-week header {
		order: 1;
		flex: none;
		padding-inline: 0;
	}
	.shelf-week .add {
		order: 2;
		flex: none;
	}
	.shelf-week .items {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		order: 3;
		flex: 1;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: thin;
		gap: 0 4px;
	}
	.shelf-week .row {
		flex: 0 0 auto;
		width: max-content;
		max-width: 260px;
	}
	.shelf-sidebar header {
		padding-bottom: 4px;
	}
	.row {
		position: relative;
		min-width: 0;
	}
	.row.insert-before::before,
	.row.insert-after::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		height: 2px;
		background: var(--cg-text-primary);
		z-index: 2;
		pointer-events: none;
	}
	.row.insert-before::before {
		top: -1px;
	}
	.row.insert-after::after {
		bottom: -1px;
	}
	.row.indented {
		margin-left: 24px;
		border-left: 1px solid var(--cg-border-default);
		padding-left: 8px;
	}
	.shelf :global(.tree-toggle) {
		position: absolute;
		left: -18px;
		top: 8px;
		color: var(--cg-text-muted);
		width: 16px;
		height: 20px;
		z-index: 1;
	}
	.add {
		display: flex;
	}
	@media (max-width: 800px) {
		.shelf-week {
			flex-direction: column;
			height: auto;
			align-items: stretch;
		}
		.shelf-week header,
		.shelf-week .add,
		.shelf-week .items {
			order: 0;
		}
		.shelf-week .items {
			flex-direction: column;
			align-items: stretch;
		}
		.shelf-week .row {
			width: auto;
			max-width: none;
		}
		.shelf-day,
		.shelf-day:first-child {
			border-left: 0;
			border-top: 1px solid var(--cg-border-default);
			padding-left: 0;
		}
		.shelf :global(.tree-toggle) {
			min-height: 44px;
		}
	}
</style>
