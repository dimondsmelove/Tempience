<script lang="ts">
	import type {
		ExplorerIntersection,
		ExplorerScope,
		ExplorerTrace
	} from '$lib/model/Snapshot/types';
	import type { Hierarchy } from '../Hierarchy/Hierarchy';
	import type { MoveTarget } from '../MoveIntention/types';
	import { locale, t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { tempienceRepository } from '$lib/state/triplit';
	import ContextSection from '$lib/context/ContextSection/ContextSection.svelte';
	import type { TaskOutcomeChoice } from '../TaskStatus/types';
	import TaskOverview from '../TaskOverview/TaskOverview.svelte';
	import TaskRecords from '../TaskRecords/TaskRecords.svelte';
	import type { IntentionAssessment } from '$lib/state/triplit/IntentionAssessments/types';
	import type { UndoState } from '$lib/state/Undo/Undo.svelte';
	import { FoldedSections } from '$lib/context/ContextSection/FoldedSections.svelte';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { ScopePicker, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import DatePopover from './DatePopover.svelte';
	import CreateForm from './CreateForm.svelte';
	import { childDateLabel, panelRelations, scopesOf, traceDate } from './panel';
	import { TASK_SECTIONS, TASK_SECTIONS_STORAGE_KEY } from './sections';
	let {
		trace,
		traces,
		scopes,
		links,
		assessments,
		undo,
		reload,
		hierarchy,
		zone,
		weekStart,
		today,
		add,
		complete,
		preset,
		setStatus,
		setPanelOutcome,
		ondelete,
		move,
		onnavigate,
		onedit,
		onrefresh
	}: {
		trace: ExplorerTrace;
		traces: readonly ExplorerTrace[];
		scopes: readonly ExplorerScope[];
		links: readonly ExplorerIntersection[];
		assessments: readonly IntentionAssessment[];
		undo: UndoState;
		reload: () => Promise<void>;
		hierarchy: Hierarchy;
		zone: string;
		weekStart: number;
		today: string;
		add: (
			title: string,
			target: MoveTarget,
			scopeIds?: readonly string[],
			parentId?: string
		) => Promise<string | null>;
		complete: (id: string) => void;
		preset: (id: string, value: TaskOutcomeChoice) => void;
		setStatus: (id: string, open: boolean) => void;
		setPanelOutcome: (id: string, value: TaskOutcomeChoice) => void;
		ondelete: (id: string) => void;
		move: (id: string, day: string | null) => void;
		onnavigate: (id: string) => void;
		onedit: () => void;
		onrefresh: () => void;
	} = $props();
	let adding = $state(false),
		busy = $state(false),
		failure = $state('');
	const folds = new FoldedSections(TASK_SECTIONS, TASK_SECTIONS_STORAGE_KEY);
	const relations = $derived(panelRelations(trace.id, hierarchy, traces));
	const ownScopes = $derived(scopesOf(trace.id, scopes, links));
	const options = $derived(scopeOptionsOf(scopes, links));
	const membership = async (scopeId: string, remove: boolean) => {
		if (busy) return;
		busy = true;
		failure = '';
		try {
			await tempienceRepository.saveTraceRecord({
				id: trace.id,
				fields: {},
				memberships: remove ? { add: [], remove: [scopeId] } : { add: [scopeId], remove: [] }
			});
			onrefresh();
		} catch (cause) {
			failure = errorText(cause);
		} finally {
			busy = false;
		}
	};
	const keydown = (event: KeyboardEvent) => {
		if (
			event.key === 'Escape' &&
			adding &&
			!event.defaultPrevented &&
			!(event.currentTarget as HTMLElement).querySelector('[popover]:popover-open')
		) {
			adding = false;
			event.stopPropagation();
		}
	};
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="panel" onkeydown={keydown}>
	<TaskOverview
		{trace}
		{relations}
		{zone}
		{complete}
		{preset}
		{setStatus}
		{setPanelOutcome}
		{ondelete}
		{move}
		{onnavigate}
		{onedit}
		{onrefresh}
		collapsed={folds.collapsed.overview}
		ontoggle={() => folds.toggle('overview')}
	/>
	<ContextSection
		id="task-scope"
		label={t('intentions.scope')}
		collapsed={folds.collapsed.scope}
		ontoggle={() => folds.toggle('scope')}
	>
		<div class="scope-list">
			{#each ownScopes as scope (scope.id)}<ScopeChip
					id={scope.id}
					name={scope.name}
					colorHue={scope.colorHue}
					colorChroma={scope.colorChroma}
					colorDepth={scope.colorDepth}
					disabled={busy}
					removeLabel={t('intentions.removeScope', { name: scope.name })}
					onremove={() => void membership(scope.id, true)}
				/>{/each}<ScopePicker
				inline
				scopes={options}
				exclude={ownScopes.map((scope) => scope.id)}
				label={t('belonging.add')}
				placeholder={t('belonging.add')}
				disabled={busy}
				onpick={(id) => {
					if (id) void membership(id, false);
				}}
			/>
		</div>
		{#if failure}<span role="alert" class="text-sm text-[color:var(--cg-danger)]">{failure}</span
			>{/if}
	</ContextSection>
	<ContextSection
		id="task-subtasks"
		label={t('intentions.panelSubtasks')}
		title={relations.progress
			? `${t('intentions.panelSubtasks')} · ${relations.progress.done}/${relations.progress.total}`
			: t('intentions.panelSubtasks')}
		collapsed={folds.collapsed.subtasks}
		ontoggle={() => folds.toggle('subtasks')}
	>
		{#snippet titleExtra()}
			{#if relations.progress}<span class="segments" aria-hidden="true">
					{#each Array.from({ length: Math.min(6, relations.progress.total) }, (_, i) => i) as i (i)}<span
							class:done={i <
								Math.round(
									(relations.progress.done / relations.progress.total) *
										Math.min(6, relations.progress.total)
								)}
						></span>{/each}
				</span>{/if}
		{/snippet}
		{#each relations.children as child (child.id)}<div class="child" data-testid="panel-subtask">
				<Button
					variant="quiet"
					size="sm"
					icon
					type="button"
					aria-label={t(child.intentOpen === false ? 'intentions.reopen' : 'intentions.complete')}
					onclick={() => complete(child.id)}
					><span class:checked={child.intentOpen === false} class="check"
						>{child.intentOpen === false ? '✓' : ''}</span
					></Button
				><button
					type="button"
					class:finished={child.intentOpen === false}
					class="child-title"
					onclick={() => onnavigate(child.id)}>{child.content.split('\n')[0]}</button
				><span class="child-date"
					><DatePopover
						value={traceDate(child, zone)}
						label="{t('intentions.date')}: {child.content.split('\n')[0]}"
						disabled={child.intentOpen === false}
						onchange={(value) => move(child.id, value)}
						onclear={() => move(child.id, null)}
						>{childDateLabel(child, zone, locale.current, t('intentions.undated'))}</DatePopover
					></span
				>
			</div>{/each}
		{#if adding}<CreateForm
				initialTarget={{ kind: 'undated' }}
				{weekStart}
				{today}
				{scopes}
				{links}
				{traces}
				{add}
				lockedParentId={trace.id}
				onclose={() => (adding = false)}
			/>{:else}<div class="add-subtask">
				<Button variant="quiet" size="sm" type="button" onclick={() => (adding = true)}
					>{t('intentions.panelAddSubtask')}</Button
				>
			</div>{/if}
	</ContextSection>
	<TaskRecords
		taskId={trace.id}
		{traces}
		{links}
		{assessments}
		{zone}
		{undo}
		{reload}
		collapsed={folds.collapsed.results}
		ontoggle={() => folds.toggle('results')}
	/>
</div>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		min-width: 0;
	}
	.scope-list,
	.child {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}
	.add-subtask :global(button) {
		margin-left: calc(-1 * var(--cg-control-padding-x) * 0.833333);
	}
	.child > :global(button:first-child) {
		width: 1rem;
		min-height: 1rem;
		padding: 0;
		border: 0;
	}
	.scope-list {
		flex-wrap: wrap;
	}
	.check {
		display: inline-flex;
		width: 1rem;
		height: 1rem;
		flex: none;
		align-items: center;
		justify-content: center;
		border: 1px solid var(--cg-text-muted);
		border-radius: 50%;
		font-size: 0.75rem;
	}
	.check.checked {
		background: var(--cg-text-muted);
		color: var(--cg-bg-surface);
	}
	.child {
		align-items: flex-start;
	}
	.child-title {
		flex: 1;
		min-width: 0;
		text-align: left;
		overflow-wrap: anywhere;
		font-size: 0.875rem;
	}
	.finished {
		color: var(--cg-text-muted);
		text-decoration: line-through;
	}
	.child-date {
		white-space: nowrap;
	}
	.segments {
		display: flex;
		gap: 2px;
	}
	.segments span {
		width: 0.75rem;
		height: 3px;
		background: var(--cg-border-default);
	}
	.segments .done {
		background: var(--cg-text-muted);
	}
</style>
