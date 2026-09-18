<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import {
		ChevronDownOutline,
		ChevronRightOutline,
		CirclePlusOutline,
		TrashBinOutline,
		PenOutline,
		PlusOutline
	} from 'flowbite-svelte-icons';
	import ScopeEditor from '$lib/context/ScopeEditor/ScopeEditor.svelte';
	import ScopeKinds from '$lib/context/ScopeEditor/ScopeKinds.svelte';
	import { offerUndo } from '$lib/context/undo';
	import Button from '$lib/ui/Button/Button.svelte';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { ScopeKindsReader } from '$lib/state/Records/ScopeKinds.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import { INTERSECTION_KEYS } from '$lib/context/EntityView/constants';
	import {
		GROUP_HEADING_CLASS,
		LIST_BUTTON_CLASS,
		SECTION_HEADING_CLASS
	} from '$lib/context/constants';
	import { explorerEntitiesById } from '$lib/model/Snapshot/Snapshot';
	import { entityLabel, formatDay } from '$lib/context/labels';
	import {
		SCOPE_SECTIONS,
		readScopeCollapsed,
		writeScopeCollapsed,
		type ScopeSection
	} from './sections';
	import type { ScopeViewProps } from './types';
	let { workbench }: ScopeViewProps = $props();
	let editing = $state(false);
	/** While the editor is open its input is under the app's exit rule (ANSWERS Q8). */
	let scopeDirty: (() => boolean) | null = null;
	let unwatch: (() => void) | null = null;
	const stopEditing = (): void => {
		unwatch?.();
		unwatch = null;
		scopeDirty = null;
		editing = false;
	};
	const startEditing = (): void => {
		editing = true;
		unwatch = draftGuard.watchInput({ dirty: () => scopeDirty?.() ?? false, discard: stopEditing });
	};
	$effect(() => () => unwatch?.());
	const context = $derived(workbench.scopeContext);
	/** The Kinds directly bound to this Scope: shown in their own part, counted by the deletion. */
	const scopeKinds = new ScopeKindsReader(tempienceRepository);
	$effect(() => {
		const scopeId = context?.record.id;
		if (!scopeId) return;
		// Read again with the timeline, never for a redisplay in another language.
		void workbench.loaded;
		untrack(() => void scopeKinds.load(scopeId));
	});
	let removing = $state(false);
	let refusal = $state.raw<unknown>(null);
	/**
	 * Deleting a Scope takes it off the timeline and hides the Kind memberships it had, each
	 * stamped with this deletion; the records in it are not touched. It is an action that can be
	 * taken back, and the same deleted Scope can be brought back later as an ordinary action.
	 */
	const remove = async (): Promise<void> => {
		const id = context?.record.id;
		if (!id || removing) return;
		removing = true;
		refusal = null;
		const outcome = await offerUndo({
			undo: workbench.undo,
			space: activeDataSpace.id,
			repository: tempienceRepository,
			label: () => t('scope.deletedLabel'),
			write: async () => {
				const { operation } = await tempienceRepository.setScopeDeleted(id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			read: () => reloadForSaved(workbench, loadWorkbenchSnapshot)
		});
		refusal = outcome.refusal;
		removing = false;
	};
	const entities = $derived(explorerEntitiesById(workbench.view));
	/**
	 * Links of the Scope other than what the sections above already show: memberships are the
	 * records list, `child_of` is the hierarchy. What remains is `related_to` and the rest.
	 */
	const otherLinks = $derived(
		workbench.view.intersections.filter(
			(link) =>
				(link.fromId === workbench.selection.scopeId ||
					link.toId === workbench.selection.scopeId) &&
				link.kind !== 'belongs_to' &&
				link.kind !== 'child_of'
		)
	);
	/** Folded sections are remembered across Scopes and reloads, like a record's Context. */
	let collapsed = $state(readScopeCollapsed());
	const toggle = (id: ScopeSection): void => {
		collapsed[id] = !collapsed[id];
		writeScopeCollapsed($state.snapshot(collapsed));
	};
	const counts = $derived.by((): Partial<Record<ScopeSection, number>> => ({
		kinds: scopeKinds.kinds.length,
		records: context?.traces.length ?? 0,
		links: otherLinks.length
	}));
	const sectionTitle = (id: ScopeSection, label: string): string =>
		counts[id] === undefined ? label : `${label} · ${counts[id]}`;
</script>

{#snippet section(id: ScopeSection, label: string, body: Snippet)}
	<section
		class="flex flex-col gap-2 border-t border-outline pt-2"
		id={`context-section-${id}`}
		data-testid={`context-section-${id}`}
	>
		<div class="flex items-center justify-between gap-1">
			<h3 class={SECTION_HEADING_CLASS}>{sectionTitle(id, label)}</h3>
			<Button
				size="sm"
				variant="quiet"
				icon
				aria-expanded={!collapsed[id]}
				aria-label={collapsed[id]
					? t('context.expand', { section: label })
					: t('context.collapse', { section: label })}
				data-testid={`section-toggle-${id}`}
				onclick={() => toggle(id)}
			>
				{#if collapsed[id]}<ChevronRightOutline class="h-4 w-4" />{:else}<ChevronDownOutline
						class="h-4 w-4"
					/>{/if}
			</Button>
		</div>
		{#if !collapsed[id]}{@render body()}{/if}
	</section>
{/snippet}

{#if context}
	<section class="flex flex-col gap-3" data-testid="context-scope">
		{#if editing}
			{#key context.record.id}<ScopeEditor
					scope={context.record}
					parentId={context.parent?.id}
					watch={(dirty) => (scopeDirty = dirty)}
					oncancel={stopEditing}
					onsaved={async () => {
						await workbench.load(loadWorkbenchSnapshot);
						stopEditing();
					}}
				/>{/key}
		{:else}
			<span class="font-mono text-xs text-muted"
				>{t('scope.subtreeRecords', { count: context.traces.length })}</span
			>
			<h2 class="text-lg leading-snug font-semibold break-words" data-testid="selected-title">
				{context.record.name}
			</h2>
			<!-- One row of icons; the name of each action is its tooltip and its accessible name. -->
			<div class="flex items-center gap-1" role="group" aria-label={t('scope.editAction')}>
				<Button
					size="sm"
					icon
					aria-label={t('scope.editAction')}
					title={t('scope.editAction')}
					onclick={startEditing}><PenOutline class="h-4 w-4" /></Button
				>
				<Button
					size="sm"
					icon
					aria-label={t('scope.captureHere')}
					title={t('scope.captureHere')}
					data-testid="scope-capture-here"
					onclick={() => workbench.openCapture({ scopeId: context!.record.id })}
					><PlusOutline class="h-4 w-4" /></Button
				>
				<Button
					size="sm"
					icon
					aria-label={t('scope.childNew')}
					title={t('scope.childNew')}
					data-testid="scope-child-new"
					onclick={() => workbench.createScope(context!.record.id)}
					><CirclePlusOutline class="h-4 w-4" /></Button
				>
				<Button
					size="sm"
					icon
					variant="quiet"
					disabled={removing || scopeKinds.loading}
					aria-label={t('scope.delete')}
					title={t('scope.delete')}
					data-testid="delete-scope"
					onclick={() => void remove()}><TrashBinOutline class="h-4 w-4" /></Button
				>
			</div>
			{#if refusal}
				<p
					role="alert"
					class="text-sm text-[color:var(--cg-danger)]"
					data-testid="delete-scope-error"
				>
					{t('scope.deleteFailed', { message: errorText(refusal) })}
				</p>
			{/if}
			{#if context.range}<p class="font-mono text-xs text-muted">
					{formatDay(context.range.start)} — {formatDay(context.range.end)}
				</p>{/if}
			{#if context.record.note}<p class="text-sm whitespace-pre-wrap">{context.record.note}</p>{/if}

			{#snippet hierarchy()}
				{#if context.parent}
					<h4 class={GROUP_HEADING_CLASS}>{t('scope.parent')}</h4>
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						onclick={() => workbench.selectScope(context!.parent!.id, 'context')}
						>{context.parent.name}</button
					>
				{/if}
				{#if context.children.length}
					<h4 class={GROUP_HEADING_CLASS}>{t('scope.children')}</h4>
					{#each context.children as scope (scope.id)}
						<button
							type="button"
							class={LIST_BUTTON_CLASS}
							onclick={() => workbench.selectScope(scope.id, 'context')}>{scope.name}</button
						>
					{/each}
				{/if}
				{#if !context.parent && !context.children.length}
					<p class="text-sm text-muted">{t('scope.hierarchyNone')}</p>
				{/if}
			{/snippet}
			{#snippet kinds()}
				<ScopeKinds
					kinds={scopeKinds.kinds}
					busy={scopeKinds.loading}
					error={scopeKinds.error}
					onopen={(kind) => workbench.forms.showHistory(kind.id, kind.currentKindVId)}
					oncreate={() => workbench.forms.createKind([context!.record.id])}
				/>
			{/snippet}
			{#snippet records()}
				{#each context.traces as item (item.record.id)}
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						data-testid="scope-record"
						data-trace-id={item.record.id}
						onclick={() => workbench.selectTrace(item.record.id, 'context')}
					>
						<span class="font-mono text-xs text-muted"
							>{item.time ? formatDay(item.time.start) : t('scope.timeUnknown')}</span
						>
						<span class="text-sm">{item.record.displayTitle ?? item.record.content}</span>
					</button>
				{:else}<p class="text-sm text-muted">{t('scope.noRecords')}</p>{/each}
			{/snippet}
			{#snippet links()}
				{#each otherLinks as link (link.id)}
					{@const otherId = link.fromId === context.record.id ? link.toId : link.fromId}
					{@const other = entities.get(otherId)}
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						data-testid="scope-link"
						onclick={() => workbench.selectIntersection(link.id)}
						>{t(INTERSECTION_KEYS[link.kind])} · {other ? entityLabel(other) : otherId}</button
					>
				{:else}<p class="text-sm text-muted">{t('scope.noOtherLinks')}</p>{/each}
			{/snippet}
			{#each SCOPE_SECTIONS as entry (entry.id)}
				{@render section(
					entry.id,
					t(entry.label),
					entry.id === 'hierarchy'
						? hierarchy
						: entry.id === 'kinds'
							? kinds
							: entry.id === 'records'
								? records
								: links
				)}
			{/each}
		{/if}
	</section>
{:else}<p class="text-sm text-muted">{t('scope.notFound')}</p>{/if}
