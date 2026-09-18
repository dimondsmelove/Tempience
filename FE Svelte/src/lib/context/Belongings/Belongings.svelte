<script lang="ts">
	import { t } from '$lib/state/Locale/Locale.svelte';
	import { errorText } from '$lib/state/Locale/errors';
	import { GROUP_HEADING_CLASS, LIST_BUTTON_CLASS } from '$lib/context/constants';
	import { ancestorsOf, scopeTree } from '$lib/model/Projection/tree';
	import { tempienceRepository } from '$lib/state/triplit';
	import { activeDataSpace } from '$lib/state/triplit/client';
	import { offerUndo } from '$lib/context/undo';
	import { loadWorkbenchSnapshot } from '$lib/state/Workbench/load';
	import { reloadForSaved } from '$lib/state/Workbench/open';
	import type { WorkbenchState } from '$lib/state/Workbench/Workbench.svelte';
	import type { ExplorerTrace } from '$lib/model/Snapshot/types';
	import Button from '$lib/ui/Button/Button.svelte';
	import { UNSCOPED_HINT_KEY } from './constants';

	let { workbench, trace }: { workbench: WorkbenchState; trace: ExplorerTrace } = $props();
	const snapshot = $derived(workbench.view);
	const tree = $derived(scopeTree(snapshot.scopes, snapshot.intersections));
	const scopeName = (id: string): string =>
		snapshot.scopes.find((scope) => scope.id === id)?.name ?? id;
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
	const available = $derived(
		snapshot.scopes.filter((scope) => !links.some((link) => link.toId === scope.id))
	);
	let adding = $state<string>('');
	let busy = $state(false);
	let failure = $state.raw<unknown>(null);
	let justEmptied = $state(false);
	const reload = () => reloadForSaved(workbench, loadWorkbenchSnapshot);
	const jump = (path: readonly string[]): void => {
		for (const id of path.slice(0, -1)) workbench.rows.expand(id);
		workbench.filters.showScope(path[path.length - 1]);
		workbench.selectScope(path[path.length - 1], 'context');
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
	const add = async (): Promise<void> => {
		if (!adding) return;
		busy = true;
		try {
			await tempienceRepository.createIntersection(
				{ fromId: trace.id, toId: adding, kind: 'belongs_to' },
				'user'
			);
			adding = '';
			justEmptied = false;
			await reload();
		} finally {
			busy = false;
		}
	};
</script>

<div class="flex flex-col gap-2 border-t border-outline pt-3" data-testid="belongings">
	<h3 class={GROUP_HEADING_CLASS}>{t('belonging.title')}</h3>
	{#if paths.length}
		<ul class="flex flex-col gap-1">
			{#each paths as { link, path } (link.id)}
				<li class="flex items-center gap-1">
					<button
						type="button"
						class={LIST_BUTTON_CLASS}
						data-testid="belonging"
						onclick={() => jump(path)}>{path.map(scopeName).join(' › ')}</button
					>
					<Button
						size="sm"
						variant="quiet"
						data-testid="belonging-details"
						title={t('belonging.linkDetails')}
						onclick={() => workbench.selectIntersection(link.id)}>{t('belonging.link')}</Button
					>
					<Button
						size="sm"
						variant="quiet"
						disabled={busy}
						data-testid="belonging-remove"
						title={t('belonging.removeTitle')}
						onclick={() => remove(link.id, scopeName(link.toId))}>{t('belonging.remove')}</Button
					>
				</li>
			{/each}
		</ul>
		<div>
			<Button
				size="sm"
				variant="quiet"
				data-testid="only-these-scopes"
				onclick={() => workbench.filters.setOnly(links.map((link) => link.toId))}
				>{t('belonging.onlyThese')}</Button
			>
		</div>
	{:else}
		<p class="text-sm text-muted">{justEmptied ? t(UNSCOPED_HINT_KEY) : t('belonging.none')}</p>
	{/if}
	{#if failure}
		<span role="alert" class="text-sm text-[color:var(--cg-danger)]" data-testid="belonging-error"
			>{errorText(failure)}</span
		>
	{/if}
	{#if available.length}
		<div class="flex items-center gap-1">
			<select
				class="cg-control cg-control-sm min-w-0 flex-1 border border-outline bg-[var(--cg-bg-input)] text-ink"
				aria-label={t('belonging.add')}
				data-testid="belonging-add"
				bind:value={adding}
				disabled={busy}
			>
				<option value="">{t('belonging.addOption')}</option>
				{#each available as scope (scope.id)}<option value={scope.id}>{scope.name}</option>{/each}
			</select>
			<Button size="sm" disabled={!adding || busy} data-testid="belonging-add-confirm" onclick={add}
				>{t('belonging.addConfirm')}</Button
			>
		</div>
	{/if}
</div>
