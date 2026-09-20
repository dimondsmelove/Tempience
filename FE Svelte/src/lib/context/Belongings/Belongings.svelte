<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { FilterOutline } from 'flowbite-svelte-icons';
	import { GROUP_HEADING_CLASS } from '$lib/context/constants';
	import { ancestorsOf, scopeTree } from '$lib/model/Projection/tree';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { offerUndo } from '$lib/context/undo';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import ScopeChip from '$lib/ui/ScopeChip/ScopeChip.svelte';
	import { ScopePicker, scopeOptionsOf } from '$lib/ui/ScopePicker';
	import { UNSCOPED_HINT_KEY } from './constants';

	let { workbench, trace }: { workbench: WorkbenchState; trace: ExplorerTrace } = $props();
	const snapshot = $derived(workbench.view);
	const tree = $derived(scopeTree(snapshot.scopes, snapshot.intersections));
	const scopeOf = (id: string) => snapshot.scopes.find((scope) => scope.id === id);
	const scopeName = (id: string): string => scopeOf(id)?.name ?? id;
	/** Live `belongs_to` links of the record: the intersection id is what «убрать» soft-deletes. */
	const links = $derived(
		snapshot.intersections.filter(
			(link) =>
				link.kind === 'belongs_to' &&
				link.fromId === trace.id &&
				snapshot.scopes.some((scope) => scope.id === link.toId)
		)
	);
	const paths = $derived(
		links.map((link) => ({ link, path: [...ancestorsOf(tree, link.toId).toReversed(), link.toId] }))
	);
	const options = $derived(scopeOptionsOf(snapshot.scopes, snapshot.intersections));
	const linkedIds = $derived(links.map((link) => link.toId));
	/** «Только эти Scope» is on when the timeline is narrowed to exactly this record's Scopes. */
	const onlyThese = $derived.by(() => {
		const only = workbench.filters.onlyScopes;
		return only !== null && only.size === linkedIds.length && linkedIds.every((id) => only.has(id));
	});
	let busy = $state(false);
	let failure = $state.raw<unknown>(null);
	let justEmptied = $state(false);
	const reload = () => reloadForSaved(workbench, loadWorkbenchSnapshot);
	/** Any name of a chip leads to that Scope, its ancestors unfolded on the way. */
	const jump = (scopeId: string): void => {
		for (const id of ancestorsOf(tree, scopeId)) workbench.rows.expand(id);
		workbench.filters.showScope(scopeId);
		workbench.selectScope(scopeId, 'context');
	};
	/** DP22: one membership goes; the last one may go too, and the record lands in «Без Scope». */
	const remove = async (id: string, name: string): Promise<void> => {
		busy = true;
		const outcome = await offerUndo({
			undo: workbench.undo,
			space: activeDataSpace.id,
			repository: tempienceRepository,
			label: () => t('belonging.removed', { name }),
			write: async () => {
				// A withdrawal names the operation it committed; one that found the membership
				// already gone names none, and nothing is offered back for it.
				const { operation } = await tempienceRepository.setIntersectionDeleted(id, true, 'user');
				return { operationId: operation?.id ?? null };
			},
			// Said at the commit, while the shown memberships are still the ones it left behind,
			// and kept: the reading that follows must not take the answer away with it.
			committed: () => {
				justEmptied = links.length === 1;
			},
			read: reload,
			// Taking the removal back puts the record somewhere again; there is nothing to say.
			restored: () => {
				justEmptied = false;
			}
		});
		// A refusal leaves the membership exactly as it is, and this panel is here to say so;
		// a reading that failed after an accepted removal is the workbench's own state to show.
		failure = outcome.refusal;
		busy = false;
	};
	/** A pick is the addition itself: the picker offers only Scopes the record is not in yet. */
	const add = async (scopeId: string | null): Promise<void> => {
		if (!scopeId || busy) return;
		busy = true;
		try {
			await tempienceRepository.createIntersection(
				{ fromId: trace.id, toId: scopeId, kind: 'belongs_to' },
				'user'
			);
			justEmptied = false;
			await reload();
		} finally {
			busy = false;
		}
	};
</script>

<!-- The record's Scopes as chips on one line, each in its Scope's colour: every name leads to
     its Scope, the × takes the record out of it; «Добавить Scope» adds one more, and is all that
     shows when there are none. The membership record itself has no affordance here (owner
     review 2026-09-19, п. 10). -->
<div class="flex flex-col gap-2 border-t border-outline pt-3" data-testid="belongings">
	<div class="flex items-center justify-between gap-1">
		<h3 class={GROUP_HEADING_CLASS}>{t('belonging.title')}</h3>
		{#if paths.length}
			<Button
				size="sm"
				variant="quiet"
				icon
				pressed={onlyThese}
				aria-label={onlyThese ? t('belonging.allScopes') : t('belonging.onlyThese')}
				title={onlyThese ? t('belonging.allScopes') : t('belonging.onlyThese')}
				data-testid="only-these-scopes"
				onclick={() => workbench.filters.setOnly(onlyThese ? null : linkedIds)}
				><FilterOutline class="h-4 w-4" /></Button
			>
		{/if}
	</div>
	<ul class="flex flex-wrap items-center gap-1" aria-label={t('belonging.title')}>
		{#each paths as { link, path } (link.id)}
			<li class="max-w-full min-w-0">
				<ScopeChip
					id={link.toId}
					name={scopeName(link.toId)}
					colorHue={scopeOf(link.toId)?.colorHue ?? null}
					colorChroma={scopeOf(link.toId)?.colorChroma ?? null}
					colorDepth={scopeOf(link.toId)?.colorDepth ?? null}
					path={path.slice(0, -1).map((id) => ({ id, name: scopeName(id) }))}
					testId="belonging-chip"
					openTestId="belonging"
					onopen={jump}
					disabled={busy}
					removeLabel={t('belonging.removeTitle')}
					removeTestId="belonging-remove"
					onremove={() => remove(link.id, scopeName(link.toId))}
				/>
			</li>
		{/each}
		{#if options.length > linkedIds.length}
			<li>
				<ScopePicker
					inline
					scopes={options}
					exclude={linkedIds}
					label={t('belonging.add')}
					placeholder={t('belonging.add')}
					disabled={busy}
					testId="belonging-add"
					onpick={(id) => void add(id)}
				/>
			</li>
		{/if}
	</ul>
	<!-- No Scopes: only «Добавить Scope» stands here (owner review 2026-09-19, pack 3, P6); the one
	     line said once, right after the last membership is taken away, stays. -->
	{#if !paths.length && justEmptied}
		<p class="text-sm text-muted">{t(UNSCOPED_HINT_KEY)}</p>
	{/if}
	{#if failure}
		<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="belonging-error"
			>{errorText(failure)}</span
		>
	{/if}
</div>
