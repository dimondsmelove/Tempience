<script lang="ts">
	import Button from '$lib/ui/Button/Button.svelte';
	import { onDestroy, onMount } from 'svelte';
	import { Temporal } from 'temporal-polyfill';
	import { SvelteSet } from 'svelte/reactivity';
	import { buildHierarchy } from '../Hierarchy/Hierarchy';
	import { sameTarget } from './drag';
	import { orderKey, placeAt, type OrderTarget } from '../Order/Order';
	import { readBacklogOpen, writeBacklogOpen } from './presentation';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import type { MessageKey } from '$lib/state/Locale/types';
	import { tempienceRepository, intentionOrdersRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { IntentionsState } from '$lib/state/Intentions/Intentions.svelte';
	import { UndoState } from '$lib/state/Undo/Undo.svelte';
	import UndoToast from '$lib/shell/UndoToast/UndoToast.svelte';
	import { createIntention } from '../CreateIntention/CreateIntention';
	import { completeIntention, revertCompletion } from '../CompleteIntention/CompleteIntention';
	import { moveIntention } from '../MoveIntention/MoveIntention';
	import { recordResult, setOutcome } from '../Outcome/Outcome';
	import type { ResultOutcome } from '../Outcome/types';
	import ResultDialog from '../ResultDialog/ResultDialog.svelte';
	import { finishResult } from '../ResultDialog/result';
	import type { MoveTarget } from '../MoveIntention/types';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import type { DraggedIntention } from './drag';
	import IntentionShelf from './IntentionShelf.svelte';
	import AddButton from './AddButton.svelte';
	import TaskView from './TaskView.svelte';
	import { panelCommands } from '../TaskStatus/commands';
	import IntentionEditor from './IntentionEditor.svelte';
	import SidePanel from '$lib/ui/SidePanel/SidePanel.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { closedIntentions } from '../Closed/Closed';
	import ClosedPanel from '../Closed/ClosedPanel.svelte';
	import BacklogPanel from './BacklogPanel.svelte';
	import { backlogWithClosedChildren } from '../WeekModel/WeekModel';
	import { tracesByDay } from '../Traces/Traces';
	import { openView, moveHistory, type PanelHistory, type PanelView } from './panel';
	const board = new IntentionsState(tempienceRepository, { orders: intentionOrdersRepository });
	const stop = board.start();
	const undo = new UndoState();
	undo.space = () => activeDataSpace.id;
	onDestroy(() => {
		stop();
		undo.dismiss();
	});
	let drag = $state<DraggedIntention | null>(null);
	const startDrag = (
		trace: ExplorerTrace,
		source: OrderTarget | undefined,
		event: DragEvent,
		nested: boolean
	) => {
		if (trace.intentOpen === false || !event.dataTransfer) {
			event.preventDefault();
			return;
		}
		drag = { id: trace.id, open: true, source, nested };
		event.dataTransfer.effectAllowed = 'move';
		event.dataTransfer.setData('application/x-tempience-intention', trace.id);
	};
	const endDrag = () => {
		drag = null;
	};
	let resultDialog = $state<{ id: string; outcome: ResultOutcome } | null>(null);
	let error = $state('');
	let announcement = $state('');
	let history = $state<PanelHistory>({ views: [], index: -1 });
	let panelVisible = $state(false);
	let search = $state('');
	let doneLimit = $state(50);
	const view = $derived(history.views[history.index]);
	const panelId = $derived(view?.kind === 'task' || view?.kind === 'edit' ? view.id : undefined);
	const buckets = $derived(board.buckets);
	const snapshot = $derived(board.snapshot);
	const dayTraces = $derived(
		snapshot
			? tracesByDay(
					snapshot,
					board.timezone,
					buckets.days.map((day) => day.dayKey),
					board.now
				)
			: new Map()
	);
	const hierarchy = $derived(buildHierarchy(snapshot?.traces ?? [], snapshot?.intersections ?? []));
	const closed = $derived(
		snapshot
			? closedIntentions(
					snapshot,
					board.assessments,
					board.timezone,
					doneLimit,
					search,
					locale.current
				)
			: { groups: [], total: 0 }
	);
	const backlogOpen = $derived(panelVisible && view?.kind === 'backlog');
	const panelTitle = $derived(
		view?.kind === 'edit'
			? t('intentions.editView')
			: view?.kind === 'task'
				? t('intentions.taskView')
				: view?.kind === 'done'
					? t('intentions.doneView')
					: t('intentions.backlog')
	);
	const showView = (next: PanelView) => {
		history = openView(history, next);
		panelVisible = true;
	};
	onMount(() => {
		try {
			if (readBacklogOpen(localStorage)) showView({ kind: 'backlog' });
		} catch {
			/* Storage is optional. */
		}
	});
	const saveBacklogOpen = (open: boolean) => {
		try {
			writeBacklogOpen(localStorage, open);
		} catch {
			/* Storage is optional. */
		}
	};
	const closePanel = () =>
		draftGuard.exit(() => {
			panelVisible = false;
			saveBacklogOpen(false);
		});
	const toggleSidebar = () => {
		if (backlogOpen) closePanel();
		else
			draftGuard.exit(() => {
				showView({ kind: 'backlog' });
				saveBacklogOpen(true);
			});
	};
	$effect(() => {
		if (
			panelVisible &&
			snapshot &&
			panelId &&
			!snapshot.traces.some((trace) => trace.id === panelId)
		)
			closePanel();
	});
	const navigate = (next: PanelView) => draftGuard.exit(() => showView(next));
	const historyMove = (delta: -1 | 1) =>
		draftGuard.exit(() => {
			history = moveHistory(history, delta);
		});
	const treeItems = (items: readonly ExplorerTrace[], includeClosed = true) => {
		const result = includeClosed
			? backlogWithClosedChildren(items, snapshot?.traces ?? [], hierarchy)
			: [...items];
		const seen = new SvelteSet(result.map((item) => item.id));
		const query = search.trim().toLocaleLowerCase(locale.current);
		if (!query) return result;
		const matches = new SvelteSet(
			result
				.filter((item) =>
					item.content.split('\n')[0].toLocaleLowerCase(locale.current).includes(query)
				)
				.map((item) => item.id)
		);
		const addParents = (id: string) => {
			for (const parent of hierarchy.get(id)?.parents ?? [])
				if (seen.has(parent) && !matches.has(parent)) {
					matches.add(parent);
					addParents(parent);
				}
		};
		for (const id of [...matches]) addParents(id);
		return result.filter((item) => matches.has(item.id));
	};
	const weekNumber = $derived(Temporal.PlainDate.from(buckets.days[0].dayKey).weekOfYear ?? 1);
	const label = (key: string, options: Intl.DateTimeFormatOptions) =>
		new Intl.DateTimeFormat(locale.current, { ...options, timeZone: 'UTC' }).format(
			new Date(`${key}T12:00:00Z`)
		);
	const reason = (code: string) => t(`intentions.${code}` as MessageKey);
	const add = async (
		title: string,
		target: MoveTarget,
		scopeIds?: readonly string[],
		parentId?: string
	): Promise<string | null> => {
		try {
			const result = await createIntention(tempienceRepository, {
				title,
				target,
				scopeIds,
				parentId,
				zone: board.timezone,
				now: Date.now()
			});
			if (!result.ok) {
				return reason(result.reason);
			}
			error = '';
			await board.refresh();
			return null;
		} catch (cause) {
			return errorText(cause);
		}
	};
	const { changeStatus, deleteTask } = panelCommands({
		undo,
		refresh: () => board.refresh(),
		failure: (message) => (error = message),
		close: () => (panelVisible = false)
	});
	const complete = async (id: string, forceComplete = false) => {
		try {
			if (
				!forceComplete &&
				snapshot?.traces.find((trace) => trace.id === id)?.intentOpen === false
			) {
				await changeStatus(id, true);
				return;
			} else {
				const result = await completeIntention(tempienceRepository, id, {
					now: Date.now(),
					zone: board.timezone
				});
				if (!result.ok) {
					error = reason(result.reason);
					return;
				}
				error = '';
				undo.offer({
					label: () => t('intentions.completed'),
					space: activeDataSpace.id,
					invert: async () => {
						const reversed = await revertCompletion(tempienceRepository, result.factId);
						if (!reversed.ok) throw new Error(reason(reversed.reason));
					},
					read: () => board.refresh()
				});
			}
			await board.refresh();
		} catch (cause) {
			error = errorText(cause);
		}
	};
	const preset = async (
		id: string,
		value: 'completed' | 'none' | 'not_completed' | ResultOutcome,
		close = true
	) => {
		if (value === 'completed') {
			await complete(id, true);
			return;
		}
		if (value === 'partial' || value === 'alternative') {
			error = '';
			resultDialog = { id, outcome: value };
			return;
		}
		try {
			const result = await setOutcome(tempienceRepository, id, value, { close });
			if (!result.ok) {
				error = reason(result.reason);
				return;
			}
			error = '';
			undo.offer({
				label: () => t('intentions.outcomeChanged'),
				space: activeDataSpace.id,
				invert: async () => {
					await tempienceRepository.undoOperation(result.operationId, 'user');
				},
				read: () => board.refresh()
			});
			await board.refresh();
		} catch (cause) {
			error = errorText(cause);
		}
	};
	const saveResult = async (
		id: string,
		outcome: ResultOutcome,
		text: string,
		target: MoveTarget | null
	) => {
		try {
			const result = await recordResult(tempienceRepository, id, text, outcome, {
				now: Date.now(),
				zone: board.timezone
			});
			if (!result.ok) {
				error = reason(result.reason);
				return false;
			}
			const factId = result.factId;
			if (!factId) throw new Error('Missing result fact');
			const finished = await finishResult(
				factId,
				outcome === 'partial' ? target : null,
				async (destination) => {
					const moved = await moveIntention(tempienceRepository, id, destination, board.timezone);
					if (!moved.ok) throw new Error(reason(moved.reason));
					// An unchanged placement creates an operation ID but no journal entry to undo.
					try {
						const logs = await tempienceRepository.listLogs(id);
						return logs.some((log) => log.operationId === moved.operationId)
							? moved.operationId
							: null;
					} catch {
						return moved.operationId;
					}
				},
				async (operation) => {
					await tempienceRepository.undoOperation(operation, 'user');
				},
				async (fact) => {
					const reversed = await revertCompletion(tempienceRepository, fact);
					if (!reversed.ok) throw new Error(reason(reversed.reason));
				}
			);
			undo.offer({
				label: () => t('intentions.resultRecorded'),
				space: activeDataSpace.id,
				invert: finished.invert,
				read: () => board.refresh()
			});
			error = finished.moveFailure ? t('intentions.resultMoveFailed') : '';
			try {
				await board.refresh();
			} catch (cause) {
				if (!error) error = errorText(cause);
			}
			return finished.moveFailure ? ('move-failed' as const) : true;
		} catch (cause) {
			error = errorText(cause);
			return false;
		}
	};
	const moveTo = async (id: string, target: MoveTarget) => {
		try {
			const result = await moveIntention(tempienceRepository, id, target, board.timezone);
			if (!result.ok) {
				error = reason(result.reason);
				return;
			}
			error = '';
			undo.offer({
				label: () => t('intentions.moved'),
				space: activeDataSpace.id,
				invert: async () => {
					await tempienceRepository.undoOperation(result.operationId, 'user');
				},
				read: () => board.refresh()
			});
			await board.refresh();
		} catch (cause) {
			error = errorText(cause);
		}
	};
	const itemsFor = (target: OrderTarget): readonly ExplorerTrace[] => {
		if (target.kind === 'day')
			return buckets.days.find((day) => day.dayKey === target.dayKey)?.items ?? [];
		if (target.kind === 'week') return buckets.week;
		return target.kind === 'later' ? buckets.later : buckets.undated;
	};
	const reorder = async (
		id: string,
		target: OrderTarget,
		beforeId: string | null,
		source?: OrderTarget
	) => {
		announcement = '';
		const key = orderKey(target, board.timezone);
		const previous = [...(board.orders[key] ?? [])];
		const ids = placeAt(
			itemsFor(target).map((item) => item.id),
			id,
			beforeId
		);
		const same = sameTarget(source, target);
		try {
			await board.batch(async () => {
				let operationId: string | undefined;
				if (!same) {
					if (target.kind === 'later') return;
					const result = await moveIntention(tempienceRepository, id, target, board.timezone);
					if (!result.ok) throw new Error(reason(result.reason));
					operationId = result.operationId;
				}
				try {
					await intentionOrdersRepository.save(key, ids);
				} catch (cause) {
					if (operationId) await tempienceRepository.undoOperation(operationId, 'user');
					throw cause;
				}
				error = '';
				announcement = t('intentions.orderChanged');
				undo.offer({
					label: () => t(same ? 'intentions.orderChanged' : 'intentions.moved'),
					space: activeDataSpace.id,
					invert: () =>
						board.batch(async () => {
							if (operationId) await tempienceRepository.undoOperation(operationId, 'user');
							await intentionOrdersRepository.save(key, previous);
						}),
					read: () => board.refresh()
				});
			});
		} catch (cause) {
			error = errorText(cause);
		}
	};
	const keyboardMove = (id: string, target: OrderTarget, direction: -1 | 1) => {
		const items = itemsFor(target);
		const ids = new Set(items.map((item) => item.id));
		const roots = items.filter(
			(item) => !(hierarchy.get(item.id)?.parents ?? []).some((parent) => ids.has(parent))
		);
		const index = roots.findIndex((item) => item.id === id);
		const destination = index + direction;
		if (index < 0 || destination < 0 || destination >= roots.length) return;
		const before = direction === -1 ? roots[destination].id : (roots[destination + 1]?.id ?? null);
		void reorder(id, target, before, target);
	};
	const move = (id: string, dayKey: string | null) =>
		moveTo(id, dayKey ? { kind: 'day', dayKey } : { kind: 'undated' });
	const edit = (id: string) => navigate({ kind: 'task', id });
</script>

<svelte:head><title>{t('intentions.title')} · Tempience</title></svelte:head>
<div class="scroll" data-testid="intentions-board">
	<main>
		<header class="top" id="intentions-top">
			<nav class="week-nav" aria-label={t('intentions.title')}>
				<Button icon aria-label={t('intentions.previous')} onclick={() => board.shift(-7)}>‹</Button
				><Button onclick={() => (board.anchor = board.now)}>{t('intentions.today')}</Button><Button
					icon
					aria-label={t('intentions.next')}
					onclick={() => board.shift(7)}>›</Button
				>
			</nav>
			<div class="heading">
				<h1>
					{label(buckets.days[0].dayKey, { day: 'numeric', month: 'long' })} – {label(
						buckets.days[6].dayKey,
						{ day: 'numeric', month: 'long', year: 'numeric' }
					)}
				</h1>
				<span class="mono">{t('intentions.weekNumber', { number: weekNumber })}</span>
			</div>
			<div class="actions">
				<Button
					class="backlog-toggle"
					pressed={backlogOpen}
					aria-label={backlogOpen ? t('intentions.collapseBacklog') : t('intentions.expandBacklog')}
					aria-expanded={backlogOpen}
					onclick={toggleSidebar}
					>{t('intentions.backlog')}<span class="mono"
						>{buckets.review.length + buckets.later.length + buckets.undated.length}</span
					></Button
				>{#if snapshot}<AddButton
						primary
						target={buckets.days.some((day) => day.dayKey === board.today)
							? { kind: 'day', dayKey: board.today }
							: { kind: 'undated' }}
						weekStart={buckets.weekStart}
						today={board.today}
						scopes={snapshot.scopes}
						links={snapshot.intersections}
						traces={snapshot.traces}
						{add}
					/>{/if}
			</div>
		</header>
		<span class="sr-only" aria-live="polite">{announcement}</span>
		<div class="board-error">
			<span id="intentions-panel-anchor"></span>
			{#if error}<p role="alert">{t('intentions.error', { message: error })}</p>{/if}
		</div>
		{#if board.loading}<p role="status">{t('intentions.loading')}</p>
		{:else if board.failure}<p role="alert">
				{t('intentions.error', { message: errorText(board.failure) })}
			</p>
		{:else if snapshot}
			<IntentionShelf
				mode="week"
				title={t('intentions.week')}
				items={buckets.week}
				target={{ kind: 'week', weekStart: buckets.weekStart }}
				weekStart={buckets.weekStart}
				todayKey={board.today}
				zone={board.timezone}
				scopes={snapshot.scopes}
				links={snapshot.intersections}
				traces={snapshot.traces}
				{hierarchy}
				{add}
				{drag}
				{startDrag}
				{endDrag}
				drop={(id, target, before) => void reorder(id, target, before, drag?.source)}
				{keyboardMove}
				complete={(id) => void complete(id)}
				preset={(id, value) => void preset(id, value)}
				assessments={board.assessments}
				move={(id, date) => void move(id, date)}
				{edit}
			/>
			<div class="board-body">
				<div class="days">
					{#each buckets.days as day (day.dayKey)}<IntentionShelf
							title={label(day.dayKey, { weekday: 'short' })}
							dayNumber={label(day.dayKey, { day: 'numeric' })}
							items={day.items}
							dayTraces={dayTraces.get(day.dayKey) ?? []}
							target={{ kind: 'day', dayKey: day.dayKey }}
							today={day.dayKey === board.today}
							weekStart={buckets.weekStart}
							todayKey={board.today}
							zone={board.timezone}
							scopes={snapshot.scopes}
							links={snapshot.intersections}
							traces={snapshot.traces}
							{hierarchy}
							{add}
							{drag}
							{startDrag}
							{endDrag}
							drop={(id, target, before) => void reorder(id, target, before, drag?.source)}
							{keyboardMove}
							complete={(id) => void complete(id)}
							preset={(id, value) => void preset(id, value)}
							assessments={board.assessments}
							move={(id, date) => void move(id, date)}
							{edit}
						/>{/each}
				</div>
			</div>
		{/if}
	</main>
</div>
<SidePanel
	open={panelVisible}
	title={panelTitle}
	canBack={history.index > 0}
	canForward={history.index < history.views.length - 1}
	position={{ n: history.index + 1 || null, m: history.views.length }}
	onback={() => historyMove(-1)}
	onforward={() => historyMove(1)}
	onclose={closePanel}
	below="#intentions-panel-anchor"
>
	{#if snapshot && view}
		{#if view.kind === 'task'}
			{#if snapshot.traces.find((trace) => trace.id === view.id)}
				{#key view.id}<TaskView
						trace={snapshot.traces.find((trace) => trace.id === view.id)!}
						traces={snapshot.traces}
						scopes={snapshot.scopes}
						links={snapshot.intersections}
						assessments={board.assessments}
						{undo}
						reload={async () => {
							await board.refresh();
							if (board.failure) throw board.failure;
						}}
						{hierarchy}
						zone={board.timezone}
						weekStart={buckets.weekStart}
						today={board.today}
						{add}
						{complete}
						preset={(id, value) => void preset(id, value)}
						setStatus={(id, value) => void changeStatus(id, value)}
						setPanelOutcome={(id, value) => void preset(id, value, false)}
						ondelete={(id) => void deleteTask(id)}
						{move}
						onnavigate={(id) => navigate({ kind: 'task', id })}
						onedit={() => navigate({ kind: 'edit', id: view.id })}
						onrefresh={() => void board.refresh()}
					/>{/key}
			{/if}
		{:else if view.kind === 'edit'}
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				onkeydown={(event) => {
					if (
						event.key === 'Escape' &&
						!event.defaultPrevented &&
						!(event.currentTarget as HTMLElement).querySelector('[popover]:popover-open')
					) {
						event.stopPropagation();
						historyMove(-1);
					}
				}}
			>
				<h2 class="cg-heading">{t('intentions.editTask')}</h2>
				{#key view.id}<IntentionEditor
						id={view.id}
						onclose={() => {
							void board.refresh();
							history = moveHistory(history, -1);
						}}
					/>{/key}
			</div>
		{:else}
			<div class="tabs">
				<Button
					size="sm"
					pressed={view.kind === 'backlog'}
					onclick={() => navigate({ kind: 'backlog' })}>{t('intentions.backlog')}</Button
				><Button size="sm" pressed={view.kind === 'done'} onclick={() => navigate({ kind: 'done' })}
					>{t('intentions.doneView')}</Button
				>
			</div>
			<div class="search-wrap">
				<svg class="search-icon" width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"
					><path
						d="M7 12a5 5 0 100-10 5 5 0 000 10zM14 14l-3.5-3.5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
						stroke-linejoin="round"
					/></svg
				>
				<input
					class="cg-control cg-field search"
					aria-label={t('intentions.searchTasks')}
					placeholder={t('intentions.searchTasks')}
					bind:value={search}
				/>
			</div>
			{#if view.kind === 'backlog'}
				<BacklogPanel
					{buckets}
					{treeItems}
					zone={board.timezone}
					scopes={snapshot.scopes}
					links={snapshot.intersections}
					traces={snapshot.traces}
					{hierarchy}
					{add}
					{drag}
					{startDrag}
					{endDrag}
					drop={(id, target, before) => void reorder(id, target, before, drag?.source)}
					{keyboardMove}
					complete={(id) => void complete(id)}
					preset={(id, value) => void preset(id, value)}
					assessments={board.assessments}
					move={(id, date) => void move(id, date)}
					{edit}
					today={board.today}
					{search}
				/>
			{:else}
				<ClosedPanel
					{closed}
					{doneLimit}
					today={board.today}
					traces={snapshot.traces}
					links={snapshot.intersections}
					assessments={board.assessments}
					{search}
					reopen={(id) => void complete(id)}
					{edit}
					more={() => (doneLimit += 50)}
				/>
			{/if}
		{/if}
	{/if}
</SidePanel>
{#if resultDialog}
	<ResultDialog
		outcome={resultDialog.outcome}
		title={snapshot?.traces
			.find((trace) => trace.id === resultDialog?.id)
			?.content.split('\n')[0] ?? ''}
		zone={board.timezone}
		weekStart={buckets.weekStart}
		failure={error}
		cancel={() => (resultDialog = null)}
		save={(text, target) => saveResult(resultDialog!.id, resultDialog!.outcome, text, target)}
	/>
{/if}
<UndoToast {undo} />

<style>
	.scroll {
		overflow-y: auto;
		overflow-x: hidden;
		min-width: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	main {
		min-width: 0;
		flex: 1 0 auto;
		padding: 20px 24px 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.top,
	.heading,
	.week-nav,
	.actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.top {
		flex-wrap: wrap;
		gap: 16px;
	}
	.heading {
		min-width: 0;
		flex: 1;
	}
	.heading h1 {
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.heading .mono,
	.week-nav,
	.actions {
		flex-shrink: 0;
	}
	.board-error {
		height: 0;
		position: relative;
		z-index: 3;
	}
	#intentions-panel-anchor {
		position: absolute;
		top: 12px;
	}
	.board-error p {
		position: absolute;
		top: 0;
		background: var(--cg-bg-surface);
		color: var(--cg-text-muted);
	}
	.actions {
		margin-left: auto;
		gap: 12px;
	}
	h1 {
		font-size: 24px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}
	.mono {
		font-family: var(--cg-font-mono);
		color: var(--cg-text-muted);
		font-size: 12px;
	}
	.top :global(.backlog-toggle) {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}
	.board-body {
		position: relative;
		flex: 1;
		display: flex;
		min-width: 0;
		border-top: 1px solid var(--cg-border-default);
	}
	.days {
		display: grid;
		grid-template-columns: repeat(7, minmax(0, 1fr));
		flex: 1;
		min-width: 0;
	}
	.tabs {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.search-wrap {
		position: relative;
	}
	.search-icon {
		position: absolute;
		left: 10px;
		top: 50%;
		transform: translateY(-50%);
		color: var(--cg-text-muted);
		pointer-events: none;
	}
	.search-wrap .search {
		width: 100%;
		padding-left: 30px;
	}
	@media (max-width: 800px) {
		main {
			padding: 16px 16px 0;
		}
		.heading {
			order: 3;
			flex-basis: 100%;
			flex-wrap: wrap;
		}
		.heading h1 {
			white-space: normal;
			overflow: visible;
			overflow-wrap: anywhere;
		}
		.actions {
			margin-left: auto;
		}
		.days {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
