<script lang="ts">
	import { errorText } from '$lib/state/Locale/errors';
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import {
		ChevronDownOutline,
		ChevronRightOutline,
		CirclePlusOutline,
		CloseOutline,
		TrashBinOutline,
		PenOutline,
		PlusOutline
	} from 'flowbite-svelte-icons';
	import ColorBlossomPicker from '$lib/context/ScopeEditor/ColorBlossomPicker/ColorBlossomPicker.svelte';
	import ScopeEditor from '$lib/context/ScopeEditor/ScopeEditor.svelte';
	import ScopeKinds from '$lib/context/ScopeEditor/ScopeKinds.svelte';
	import { offerUndo } from '$lib/context/undo';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { DOT_HEADING_PX, ScopeDot } from '$lib/ui/ScopeDot';
	import { lensSource } from '$lib/ui/LensSource';
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { draftGuard } from '$lib/state/TraceDraft/guard.svelte';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { ScopeKindsReader } from '$lib/state/Records/ScopeKinds.svelte';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import { INTERSECTION_KEYS } from '$lib/context/EntityView/constants';
	import type { ScopeColour } from '$lib/theme/scope-colour';
	import {
		GROUP_HEADING_CLASS,
		LIST_BUTTON_CLASS,
		SECTION_HEADING_CLASS
	} from '$lib/context/constants';
	import { explorerEntitiesById } from '$lib/model/Snapshot/Snapshot';
	import { UNSCOPED_ROW_ID, UNSCOPED_ROW_KEY } from '$lib/model/Projection/constants';
	import { entityLabel, formatDay } from '$lib/context/labels';
	import { entityLens } from '$lib/context/lens';
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
	/** The «Без Scope» row chosen: a list of records with nothing to edit, bind or delete. */
	const unscoped = $derived(context?.record.id === UNSCOPED_ROW_ID);
	/** The Kinds directly bound to this Scope: shown in their own part, counted by the deletion. */
	const scopeKinds = new ScopeKindsReader(tempienceRepository);
	$effect(() => {
		const scopeId = context?.record.id;
		if (!scopeId || scopeId === UNSCOPED_ROW_ID) return;
		// Read again with the timeline, never for a redisplay in another language.
		void workbench.loaded;
		untrack(() => void scopeKinds.load(scopeId));
	});
	let removing = $state(false);
	let refusal = $state.raw<unknown>(null);
	/**
	 * The dot beside the name opens the flower and saves every pick at once (C6, D): the colour
	 * shown follows the pick while the write and the reload are on their way; picks that land
	 * during a write wait as one and are written after it, then the timeline is read again once.
	 */
	type ColourPick = Readonly<{ id: string; colour: ScopeColour | null }>;
	let picked = $state.raw<ColourPick | null>(null);
	let pending: ColourPick | null = null;
	let writing = false;
	const writeColour = async (): Promise<void> => {
		if (writing) return;
		writing = true;
		try {
			while (pending !== null) {
				const { id, colour } = pending;
				pending = null;
				await tempienceRepository.editScope(id, {
					colorHue: colour?.hue ?? null,
					colorChroma: colour?.chroma ?? null,
					colorDepth: colour?.depth ?? null
				});
			}
			await workbench.load(loadWorkbenchSnapshot);
		} catch (cause) {
			refusal = cause ?? new Error();
		} finally {
			writing = false;
			picked = null;
		}
	};
	const pickColour = (colour: ScopeColour | null): void => {
		const id = context?.record.id;
		if (!id || id === UNSCOPED_ROW_ID) return;
		picked = pending = { id, colour };
		refusal = null;
		void writeColour();
	};
	const shownColour = $derived.by(() => {
		if (picked !== null && picked.id === context?.record.id)
			return {
				hue: picked.colour?.hue ?? null,
				chroma: picked.colour?.chroma ?? null,
				depth: picked.colour?.depth ?? null
			};
		return {
			hue: context?.record.colorHue ?? null,
			chroma: context?.record.colorChroma ?? null,
			depth: context?.record.colorDepth ?? null
		};
	});
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
	/** Removing a link of the Scope is a soft delete the toast can take back (DP24), as in «Связи» of a record. */
	const unlink = async (linkId: string, label: string): Promise<void> => {
		if (removing) return;
		removing = true;
		refusal = null;
		const outcome = await offerUndo({
			undo: workbench.undo,
			space: activeDataSpace.id,
			repository: tempienceRepository,
			label: () => t('link.removed', { title: label }),
			write: async () => {
				const { operation } = await tempienceRepository.setIntersectionDeleted(
					linkId,
					true,
					'user'
				);
				return { operationId: operation?.id ?? null };
			},
			read: () => reloadForSaved(workbench, loadWorkbenchSnapshot)
		});
		refusal = outcome.refusal;
		removing = false;
	};
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
	/** «Без Scope» has only its records; «Заметка» stands only while the Scope has one. */
	const shown = $derived(
		SCOPE_SECTIONS.filter((entry) =>
			unscoped ? entry.id === 'records' : entry.id !== 'note' || Boolean(context?.record.note)
		)
	);
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
			<!-- The Scope's colour beside its name (owner review 2026-09-19, pack 3, P5) is the dot that
			     opens the flower (C6, D): a pick is saved at once, no editor in between. Without a colour
			     the dot is a transparent button in the same slot; «Без Scope» has no dot and no button. -->
			<div class="flex items-center gap-2">
				{#if !unscoped}
					{#key context.record.id}
						<ColorBlossomPicker
							hue={shownColour.hue}
							chroma={shownColour.chroma}
							depth={shownColour.depth}
							label={t('scope.colour')}
							variant="dot"
							size={DOT_HEADING_PX}
							testId="scope-colour-dot"
							onpick={pickColour}
						/>
					{/key}
				{/if}
				<h2
					class="min-w-0 text-lg leading-snug font-semibold break-words"
					data-testid="selected-title"
				>
					{unscoped ? t(UNSCOPED_ROW_KEY) : context.record.name}
				</h2>
			</div>
			{#if unscoped}
				<p class="text-sm text-muted">{t('scope.unscopedHint')}</p>
			{/if}
			<!-- One row of icons; the name of each action is its tooltip and its accessible name. -->
			{#if !unscoped}<div
					class="flex items-center gap-1"
					role="group"
					aria-label={t('scope.editAction')}
				>
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
				</div>{/if}
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

			{#snippet note()}
				<p class="text-sm whitespace-pre-wrap" data-testid="scope-note">{context.record.note}</p>
			{/snippet}
			{#snippet hierarchy()}
				<!-- The parent is its chip, tinted and leading there; a child row keeps its button and
				     gains the child's colour dot before the name (owner review 2026-09-19, pack 3, P3). -->
				{#if context.parent}
					<h4 class={GROUP_HEADING_CLASS}>{t('scope.parent')}</h4>
					<div class="flex flex-wrap gap-1">
						<ScopeChip
							id={context.parent.id}
							name={context.parent.name}
							colorHue={context.parent.colorHue}
							colorChroma={context.parent.colorChroma}
							colorDepth={context.parent.colorDepth}
							testId="scope-parent-chip"
							onopen={(id) => workbench.selectScope(id, 'context')}
						/>
					</div>
				{/if}
				{#if context.children.length}
					<h4 class={GROUP_HEADING_CLASS}>{t('scope.children')}</h4>
					{#each context.children as scope (scope.id)}
						<button
							type="button"
							class={[LIST_BUTTON_CLASS, 'child-row']}
							data-testid="scope-child"
							onclick={() => workbench.selectScope(scope.id, 'context')}
							{@attach lensSource(workbench.hover, { kind: 'scope', scopeId: scope.id })}
							><ScopeDot
								colorHue={scope.colorHue}
								colorChroma={scope.colorChroma}
								colorDepth={scope.colorDepth}
							/>{scope.name}</button
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
						{@attach lensSource(workbench.hover, { kind: 'trace', traceId: item.record.id })}
					>
						<span class="font-mono text-xs text-muted"
							>{item.time ? formatDay(item.time.start) : t('scope.timeUnknown')}</span
						>
						<span class="text-sm">{item.record.displayTitle ?? item.record.content}</span>
					</button>
				{:else}<p class="text-sm text-muted">{t('scope.noRecords')}</p>{/each}
			{/snippet}
			{#snippet links()}
				<!-- One row is one link (owner 2026-09-20): its kind and the other end, then «×»; the
				     link's own Context is not opened from here. The row names the pair, the name the
				     other end alone. -->
				{#each otherLinks as link (link.id)}
					{@const otherId = link.fromId === context.record.id ? link.toId : link.fromId}
					{@const other = entities.get(otherId)}
					{@const label = other ? entityLabel(other) : otherId}
					<div
						class="flex items-center gap-1"
						data-testid="scope-link-row"
						{@attach lensSource(workbench.hover, {
							kind: 'traces',
							traceIds: [link.fromId, link.toId]
						})}
					>
						<button
							type="button"
							class={[LIST_BUTTON_CLASS, 'min-w-0 flex-1']}
							data-testid="scope-link"
							disabled={!other}
							onclick={() => other && workbench.selectEntity(other)}
							{@attach lensSource(workbench.hover, other ? entityLens(other) : null)}
							>{t(INTERSECTION_KEYS[link.kind])} · {label}</button
						>
						<Button
							size="sm"
							variant="quiet"
							icon
							disabled={removing}
							data-testid="link-remove"
							aria-label={t('link.remove')}
							title={t('link.remove')}
							onclick={() => unlink(link.id, label)}><CloseOutline class="h-4 w-4" /></Button
						>
					</div>
				{:else}<p class="text-sm text-muted">{t('scope.noOtherLinks')}</p>{/each}
			{/snippet}
			{#each shown as entry (entry.id)}
				{@render section(
					entry.id,
					t(entry.label),
					entry.id === 'note'
						? note
						: entry.id === 'hierarchy'
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

<style>
	/* A child row is one line: the dot, then the name; the list button's column layout stands aside. */
	.child-row {
		flex-direction: row;
		align-items: center;
		gap: calc(var(--cg-gap) * 0.5);
	}
</style>
