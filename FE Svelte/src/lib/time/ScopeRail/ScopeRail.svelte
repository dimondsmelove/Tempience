<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColourKey, scopeColourOf } from '$lib/theme/scope-colour';
	import PanelResize from '$lib/ui/PanelResize/PanelResize.svelte';
	import type { ProjectedRow } from '$lib/model/Projection/types';
	import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
	import { laneIndexOf, laneName } from '$lib/model/Arrangement/Arrangement';
	import { MERGED_ROW_ID_JOINER } from '$lib/model/Arrangement/constants';
	import { RAIL_MAX_WIDTH_PX, RAIL_MIN_WIDTH_PX } from './constants';
	import { RailDrag } from './drag.svelte';
	import RailMenu from './RailMenu.svelte';
	import RailRow from './RailRow.svelte';
	import type { DragSource, MergedRowInfo, ScopeRailProps } from './types';

	let {
		rows,
		filters,
		disclosure,
		arrangement,
		scopesById,
		headerHeight = $bindable(0),
		rowHeightPx,
		widthPx,
		compact,
		onCanvas = false,
		selectedRowId,
		litRowIds,
		lensRowIds = null,
		veil = 0,
		pulseRowIds,
		onhoverrow,
		onselectscope,
		onselectrow,
		onclose,
		onpreview,
		oncommit,
		oncancel,
		oncreate
	}: ScopeRailProps = $props();
	const searching = $derived(Boolean(filters.scopeQuery.trim()));
	/** A mouse or a pen over a row name lights its records on the ribbon (п. 5); a finger hovers nothing. */
	const hover = (event: PointerEvent, rowId: string | null): void => {
		if (event.pointerType !== 'touch') onhoverrow?.(rowId);
	};

	// --- Lanes behind the rows (research п. 7; C2).
	/** The lane rows in order: every row at depth 0 stands for one lane; an unfolded lane's children are its block. */
	const laneRows = $derived(rows.filter((row) => row.depth === 0));
	const bandOf = $derived(new Map(laneRows.map((row, index) => [row.id, index])));
	/** The lane a lane row stands for, found by the member it is known by: its first Scope, or the «Без Scope» row id. */
	const laneOf = (row: ProjectedRow): number | null => {
		if (!arrangement || row.depth > 0) return null;
		const member = row.kind === 'unscoped' ? UNSCOPED_ROW_ID : row.scopeIds[0];
		const index = laneIndexOf(arrangement.lanes, member);
		return index < 0 ? null : index;
	};
	/** The lane row each row belongs to: itself at depth 0, else the last lane row before it — its block. */
	const blockOf: ReadonlyMap<string, ProjectedRow> = $derived.by(() => {
		let head: ProjectedRow | null = null;
		return new Map(
			rows.flatMap((row): [string, ProjectedRow][] => {
				if (row.depth === 0) head = row;
				return head ? [[row.id, head]] : [];
			})
		);
	});
	/** A member row under an unfolded merged row (C5): the lane is the unit — no grip, no drag, no drop. */
	const inMergedBlock = (row: ProjectedRow): boolean =>
		row.depth > 0 && blockOf.get(row.id)?.kind === 'merged';
	/** The merged row's name chosen (C5): the row and the lane's members as they stand. */
	const selectRow = (row: ProjectedRow): void => {
		const index = laneOf(row);
		const lane = index === null ? null : arrangement?.lanes.lanes[index];
		onselectrow?.(row.id, lane?.members ?? row.id.split(MERGED_ROW_ID_JOINER));
	};
	/** An action on the lane behind a row; a row behind no lane (stale, a child) does nothing. */
	const act = (row: ProjectedRow, action: (laneIndex: number) => void): void => {
		const index = laneOf(row);
		if (index !== null) action(index);
	};
	/** What a merged row's name needs: its auto-name, the owner's name, and the members by name (Q1-A). */
	const mergedInfo = (row: ProjectedRow): MergedRowInfo | null => {
		const index = laneOf(row);
		const lane = index === null ? null : arrangement?.lanes.lanes[index];
		if (!lane || !scopesById) return null;
		return {
			autoName: laneName({ members: lane.members }, scopesById),
			ownerName: lane.name ?? null,
			composition: row.id
				.split(MERGED_ROW_ID_JOINER)
				.map((id) => scopesById.get(id)?.name ?? id)
				.join(' · ')
		};
	};

	// --- Drag: between rows reorders, onto a row merges («Открытые вопросы» п. 1; C2).
	/** The rows can be dragged: the rail itself, Scope grouping, no search narrowing the tree. */
	const arrangeable = $derived(
		Boolean(arrangement) && !onCanvas && disclosure.grouping === 'scope' && !searching
	);
	/** The «⋯» menu (C3): the same rows, on a wide layout — arranging the view is a desktop matter in this loop (Q5-A). */
	const menu = $derived(
		Boolean(arrangement) && !onCanvas && !compact && disclosure.grouping === 'scope'
	);
	let list = $state<HTMLOListElement | null>(null);
	const drag = new RailDrag(
		(source, target) => {
			if (!arrangement) return;
			// Band indices are places among the lane rows shown; the arrangement counts every lane.
			const laneAt = (band: number): number => laneOf(laneRows[band]) ?? -1;
			const insertAt = (band: number): number =>
				band < laneRows.length ? laneAt(band) : arrangement.lanes.lanes.length;
			if (source.lane !== null) {
				if (target.kind === 'merge') arrangement.merge(source.lane, laneAt(target.index));
				else {
					const at = insertAt(target.index);
					arrangement.reorder(source.lane, at > source.lane ? at - 1 : at);
				}
			} else if (source.scopeId)
				arrangement.claim(source.scopeId, {
					kind: target.kind,
					index: target.kind === 'merge' ? laneAt(target.index) : insertAt(target.index)
				});
		},
		() => onhoverrow?.(null)
	);
	const press = (event: PointerEvent, row: ProjectedRow): void => {
		if (
			!arrangeable ||
			!list ||
			inMergedBlock(row) ||
			!(event.target as Element).closest('[data-handle]')
		)
			return;
		const source: DragSource = {
			rowId: row.id,
			band: bandOf.get(row.id) ?? null,
			lane: laneOf(row),
			scopeId: row.scopeId
		};
		if (source.lane !== null || source.scopeId) drag.press(event, source, list);
	};
	/** The dragged row, for its ghost under the pointer. */
	const dragged = $derived(
		drag.source ? (rows.find((row) => row.id === drag.source?.rowId) ?? null) : null
	);
	/** The row the pointer would merge into, for its highlight. */
	const mergeRowId = $derived(
		drag.target?.kind === 'merge' ? (laneRows[drag.target.index]?.id ?? null) : null
	);
	/** What a reader hears of the target: the two zones in words. */
	const liveText = $derived.by(() => {
		const target = drag.target;
		if (!target) return '';
		if (target.kind === 'merge')
			return t('rail.merge', { name: laneRows[target.index]?.name ?? '' });
		return target.index < laneRows.length
			? t('rail.insertAbove', { name: laneRows[target.index].name })
			: t('rail.insertBelow', { name: laneRows.at(-1)?.name ?? '' });
	});
</script>

<svelte:window
	onkeydowncapture={(event) => {
		if (event.key !== 'Escape' || !drag.active) return;
		event.preventDefault();
		event.stopImmediatePropagation();
		drag.cancel();
	}}
/>

{#if !onCanvas}
	<header
		class="sticky top-0 z-20 flex shrink-0 flex-col justify-center border-b border-outline bg-surface"
		style:min-height="var(--time-header-height)"
	>
		<div
			class="flex min-w-0 flex-col gap-1 p-2"
			bind:clientHeight={headerHeight}
			data-testid="scope-header"
		>
			<div class="flex items-stretch gap-1">
				<div
					class="cg-field cg-control cg-control-sm flex min-w-0 flex-1 items-center focus-within:outline-2 focus-within:outline-accent"
				>
					<input
						type="search"
						class="scope-search w-0 min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
						aria-label={t('rail.search')}
						placeholder={t('rail.search')}
						value={filters.scopeQuery}
						oninput={(event) => {
							filters.scopeQuery = event.currentTarget.value;
						}}
					/>
					{#if filters.scopeQuery}
						<button
							type="button"
							class="shrink-0 cursor-pointer text-muted hover:text-ink"
							aria-label={t('rail.clearSearch')}
							onclick={() => {
								filters.scopeQuery = '';
							}}>×</button
						>
					{/if}
				</div>
				{#if oncreate}
					<Button
						size="sm"
						icon
						title={t('rail.newScope')}
						aria-label={t('rail.newScope')}
						data-testid="scope-new"
						onclick={oncreate}>+</Button
					>
				{/if}
				{#if menu && arrangement}<RailMenu {arrangement} />{/if}
				<Button
					size="sm"
					variant="quiet"
					icon
					aria-label={t('rail.close')}
					data-testid="scope-close"
					onclick={onclose}>‹</Button
				>
			</div>
		</div>
	</header>
{/if}
<ol
	class={[onCanvas ? 'canvas-names' : 'relative', drag.active && 'dragging select-none']}
	aria-label={onCanvas ? t('rail.namesOnCanvas') : t('rail.rowsOfTimeline')}
	data-testid={onCanvas ? 'scope-canvas-names' : 'scope-rail-rows'}
	bind:this={list}
	onpointerleave={(event) => hover(event, null)}
	onpointermove={(event) => drag.move(event)}
	onpointerup={(event) => drag.release(event)}
	onpointercancel={() => drag.abort()}
	onlostpointercapture={() => drag.abort()}
	onclickcapture={(event) => {
		// The click that ends a drag, or the release after Esc, chooses nothing.
		if (!drag.swallowClick) return;
		drag.swallowClick = false;
		event.stopPropagation();
		event.preventDefault();
	}}
>
	{#each rows as row (row.id)}
		<RailRow
			{row}
			{filters}
			{disclosure}
			{rowHeightPx}
			{onCanvas}
			{searching}
			arrangeable={arrangeable && !inMergedBlock(row)}
			band={arrangeable ? bandOf.get(row.id) : undefined}
			{selectedRowId}
			lit={Boolean(litRowIds?.has(row.id))}
			veiled={veil > 0 && lensRowIds !== null && !lensRowIds.has(row.id)}
			{veil}
			pulse={Boolean(pulseRowIds?.has(row.id))}
			drop={dragged?.id === row.id ? 'source' : mergeRowId === row.id ? 'merge' : null}
			merged={row.kind === 'merged' && !onCanvas ? mergedInfo(row) : null}
			claimed={Boolean(
				arrangement &&
				!onCanvas &&
				row.depth === 0 &&
				row.scopeId &&
				arrangement.isClaimed(row.scopeId)
			)}
			onhover={(event) => hover(event, row.id)}
			onpress={(event) => press(event, row)}
			onselect={onselectscope}
			onselectrow={() => selectRow(row)}
			ontoggle={() => act(row, (index) => arrangement?.toggleExpanded(index))}
			onrename={(name) => act(row, (index) => arrangement?.rename(index, name))}
			onsplit={() => act(row, (index) => arrangement?.split(index))}
			onunclaim={() => {
				if (row.scopeId) arrangement?.unclaim(row.scopeId);
			}}
		/>
	{:else}
		<li class="p-3 text-sm text-muted" role="status">
			{disclosure.grouping === 'kind'
				? t('rail.noneOnAxis')
				: searching
					? t('rail.notFound')
					: t('rail.noRows')}
		</li>
	{/each}
	{#if dragged}
		<!-- The dragged row's ghost hangs under the pointer (raised, 0.96), so the target row and the line stay in view. -->
		<div
			class="ghost pointer-events-none absolute left-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-1 rounded-[var(--cg-radius-control)] border border-outline bg-raised px-2 py-1 text-sm whitespace-nowrap text-ink shadow-md"
			style:top="{drag.pointerY + 8}px"
			data-testid="rail-drag-ghost"
			aria-hidden="true"
		>
			{#each dragged.colours as colour, index (`${index}:${scopeColourKey(colour)}`)}
				<span
					class="ghost-dot shrink-0"
					style:background={scopeColourOf(colour, appearance.scopeBase)}
				></span>
			{/each}
			<span class="min-w-0 truncate font-medium">{dragged.name}</span>
		</div>
	{/if}
	{#if drag.target?.kind === 'insert'}
		<!-- The insert target: a 2 px accent line between rows («Открытые вопросы» п. 1). -->
		<div
			class="insert-line pointer-events-none absolute inset-x-0 z-20 bg-accent"
			style:top="{drag.lineTop}px"
			data-testid="rail-insert-line"
			aria-hidden="true"
		></div>
	{/if}
</ol>
{#if arrangeable}<div class="sr-only" aria-live="polite" data-testid="rail-drag-live">
		{liveText}
	</div>{/if}
{#if !compact && !onCanvas}<PanelResize
		label={t('rail.width')}
		controls="time-scope"
		value={widthPx}
		min={RAIL_MIN_WIDTH_PX}
		max={RAIL_MAX_WIDTH_PX}
		side="right"
		{onpreview}
		{oncommit}
		{oncancel}
	/>{/if}

<style>
	.scope-search {
		font: inherit;
	}
	.scope-search::-webkit-search-cancel-button {
		appearance: none;
	}

	.dragging :global(*) {
		cursor: grabbing;
	}
	.ghost {
		opacity: 0.96;
	}
	.ghost-dot {
		width: 8px;
		height: 8px;
		border-radius: 9999px;
	}
	.insert-line {
		height: 2px;
	}

	.canvas-names {
		position: absolute;
		inset: 0 auto 0 0;
		width: 48%;
		z-index: 5;
		pointer-events: none;
	}
</style>
