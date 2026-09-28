<script lang="ts">
	import { SortOutline } from 'flowbite-svelte-icons';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { untrack } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { prefersReducedMotion } from 'svelte/motion';
	import { ROW_MOVE_EASING, ROW_MOVE_MS } from '$lib/model/RowMotion/constants';
	import { planGhosts, planMotion } from '$lib/model/RowMotion/RowMotion';
	import type { MotionRow } from '$lib/model/RowMotion/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import { appearance } from '$lib/theme/appearance.svelte';
	import { scopeColourKey, scopeColourOf } from '$lib/theme/scope-colour';
	import PanelResize from '$lib/ui/PanelResize/PanelResize.svelte';
	import type { ProjectedRow } from '$lib/model/Projection/types';
	import { UNSCOPED_ROW_ID } from '$lib/model/Projection/constants';
	import { laneIndexOf, laneName } from '$lib/model/Arrangement/Arrangement';
	import { MERGED_ROW_ID_JOINER } from '$lib/model/Arrangement/constants';
	import { RAIL_INDENT_PX, RAIL_MAX_WIDTH_PX, RAIL_MIN_WIDTH_PX } from './constants';
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
		rowLead = null,
		heavyRowIds = null,
		quietRowIds = null,
		chapterDriven = null,
		chapterRows = null,
		animateMoves = false,
		headerBand = null,
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
	/** The chapter's shadow: a row of the chapter's own, no lane of the device. */
	const isShadow = (row: ProjectedRow): boolean =>
		Boolean(chapterDriven) &&
		row.kind === 'merged' &&
		row.scopeIds.length > 0 &&
		row.scopeIds.every((id) => chapterDriven!.rest.has(id));
	/** The «⋯» menu (C3): the same rows, on a wide layout — arranging the view is a desktop matter in this loop (Q5-A). */
	const menu = $derived(
		Boolean(arrangement) && !onCanvas && !compact && disclosure.grouping === 'scope'
	);
	let list = $state<HTMLOListElement | null>(null);

	// Rows glide to their new places (FLIP): where each row stood is read before the list
	// changes, and each moved row starts from there after it. Off unless asked, and under
	// reduced motion.
	// A row that is new comes out of the row that held its Scopes (a member unfolding out of the
	// merged rest), and a row that folds away into another slides into it before it goes — the
	// same plan the ribbon's lanes follow (model/RowMotion).
	type Placed = MotionRow & Readonly<{ element: HTMLElement }>;
	let before: Placed[] = [];
	/** The rows as last shown: what a row that is gone stood for, and what it was called. */
	let shown = new Map<string, ProjectedRow>();
	/** Rows folding away, drawn where they stood and sliding into the row that takes them in. */
	let ghosts = $state.raw<
		readonly Readonly<{ key: string; row: ProjectedRow; top: number; dy: number }>[]
	>([]);
	let ghostSerial = 0;
	const placed = (known: ReadonlyMap<string, ProjectedRow>): Placed[] =>
		[...(list?.children ?? [])].flatMap((item) => {
			const element = item as HTMLElement;
			const id = element.dataset.rowId;
			return id
				? [
						{
							id,
							scopeIds: known.get(id)?.scopeIds ?? [],
							y0: element.getBoundingClientRect().top,
							element
						}
					]
				: [];
		});
	$effect.pre(() => {
		void rows;
		if (animateMoves) before = untrack(() => placed(shown));
	});
	$effect(() => {
		const current = new Map(rows.map((row) => [row.id, row] as const));
		const was = before;
		const gone = shown;
		before = [];
		shown = current;
		if (!animateMoves || prefersReducedMotion.current || !was.length || !list) return;
		const now = placed(current);
		const plan = planMotion(was, now);
		for (const row of now) {
			const dy = plan.get(row.id);
			if (dy === undefined) continue;
			row.element.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], {
				duration: ROW_MOVE_MS,
				easing: ROW_MOVE_EASING
			});
		}
		const top = list.getBoundingClientRect().top;
		// Added to any still sliding: a later change must not cut a fold short.
		const folding = planGhosts(was, now).flatMap((ghost) => {
			const old = was.find((row) => row.id === ghost.id);
			const row = gone.get(ghost.id);
			return old && row
				? [{ key: `${ghost.id}#${(ghostSerial += 1)}`, row, top: old.y0 - top, dy: ghost.dy }]
				: [];
		});
		if (folding.length) ghosts = [...ghosts, ...folding];
	});
	/** A folding row's slide, and its end: it is gone once it reached the row that took it in. */
	const slide =
		(key: string, dy: number): Attachment<HTMLElement> =>
		(element) => {
			const motion = element.animate(
				[
					{ transform: 'translateY(0)', opacity: 1 },
					{ transform: `translateY(${dy}px)`, opacity: 0 }
				],
				{ duration: ROW_MOVE_MS, easing: ROW_MOVE_EASING, fill: 'forwards' }
			);
			void motion.finished.then(
				() => (ghosts = ghosts.filter((ghost) => ghost.key !== key)),
				() => undefined
			);
			return () => motion.cancel();
		};
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
			isShadow(row) ||
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

{#snippet searchRow()}
	<div class="flex min-w-0 flex-1 items-stretch gap-1">
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
		{#if chapterRows}
			<Button
				size="sm"
				variant="quiet"
				icon
				aria-pressed={chapterRows.off}
				aria-label={t(chapterRows.off ? 'chapter.rowsOn' : 'chapter.rowsOff')}
				title={t(chapterRows.off ? 'chapter.rowsOn' : 'chapter.rowsOff')}
				data-testid="chapter-rows-off"
				onclick={chapterRows.ontoggle}><SortOutline class="h-3.5 w-3.5" /></Button
			>
		{/if}
		<Button
			size="sm"
			variant="quiet"
			icon
			aria-label={t('rail.close')}
			data-testid="scope-close"
			onclick={onclose}>‹</Button
		>
	</div>
{/snippet}

{#if !onCanvas}
	<header
		class={[
			'sticky top-0 z-20 flex shrink-0 flex-col border-b border-outline bg-surface',
			headerBand ? 'justify-end' : 'justify-center'
		]}
		style:min-height="var(--time-header-height)"
	>
		{#if headerBand}
			<!-- Aligned with the time header: a line on the band's row, the search on the axis's. -->
			<div
				class="flex min-w-0 flex-col"
				bind:clientHeight={headerHeight}
				data-testid="scope-header"
			>
				<div
					class="flex min-w-0 items-stretch border-y border-outline"
					style:height="{headerBand.heightPx}px"
					data-testid="scope-header-band"
				>
					{@render headerBand.content()}
				</div>
				<div class="flex items-center px-2" style:min-height="var(--cg-axis-height)">
					{@render searchRow()}
				</div>
			</div>
		{:else}
			<div
				class="flex min-w-0 flex-col gap-1 p-2"
				bind:clientHeight={headerHeight}
				data-testid="scope-header"
			>
				{@render searchRow()}
			</div>
		{/if}
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
			arrangeable={arrangeable && !inMergedBlock(row) && !isShadow(row)}
			band={arrangeable ? bandOf.get(row.id) : undefined}
			{selectedRowId}
			lit={Boolean(litRowIds?.has(row.id))}
			veiled={veil > 0 && lensRowIds !== null && !lensRowIds.has(row.id)}
			{veil}
			pulse={Boolean(pulseRowIds?.has(row.id))}
			drop={dragged?.id === row.id ? 'source' : mergeRowId === row.id ? 'merge' : null}
			merged={row.kind === 'merged' && !onCanvas && !isShadow(row) ? mergedInfo(row) : null}
			lead={rowLead}
			heavy={Boolean(heavyRowIds?.has(row.id))}
			quiet={Boolean(quietRowIds?.has(row.id))}
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
			ontoggle={() =>
				chapterDriven && isShadow(row)
					? chapterDriven.ontoggleRest()
					: act(row, (index) => arrangement?.toggleExpanded(index))}
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
	{#each ghosts as ghost (ghost.key)}
		<li
			class="rail-ghost flex items-center overflow-hidden border-b border-outline pr-2 text-sm whitespace-nowrap text-ink"
			aria-hidden="true"
			style:top="{ghost.top}px"
			style:height="{rowHeightPx}px"
			style:padding-left="min(25%, calc(0.5rem + {ghost.row.depth * RAIL_INDENT_PX}px))"
			{@attach slide(ghost.key, ghost.dy)}
		>
			<span class="w-4 shrink-0"></span>{ghost.row.name}
		</li>
	{/each}
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
	.rail-ghost {
		position: absolute;
		left: 0;
		right: 0;
		pointer-events: none;
	}
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
